/**
 * Sentry SDK CDN 加载器 + 初始化器
 *
 * 在 HTML <head> 中尽早加载此脚本，它会：
 * 1. 异步加载 Sentry SDK from CDN
 * 2. 自动完成初始化配置
 * 3. 暴露 testSentry() 到 window 供测试
 *
 * 使用方法：
 * <script>
 *   window.SENTRY_DSN = '你的DSN';
 *   window.SENTRY_ENVIRONMENT = 'production';
 *   window.SENTRY_RELEASE = 'esim-tools@1.0.0';
 * </script>
 * <script src="/src/js/sentry-loader.js"></script>
 */

(function() {
  'use strict';

  // ===================================
  // 环境检测
  // ===================================
  var hostname = window.location.hostname;
  var isDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

  // 配置读取
  var SENTRY_DSN = window.SENTRY_DSN || '';
  var SENTRY_ENVIRONMENT = window.SENTRY_ENVIRONMENT || 'production';
  var SENTRY_RELEASE = window.SENTRY_RELEASE || 'esim-tools@unknown';

  // 初始化状态
  var sentryInitialized = false;
  var EXTENSION_NOISE_STORE_KEY = '__sentryExtensionNoiseStats';
  var EXTENSION_NOISE_SAMPLE_LIMIT = 20;
  var EXTENSION_ERROR_KEYWORDS = [
    'cannot redefine property',
    'redefine property',
    'defineproperty',
    'object.defineproperty',
    'ethereum',
    'chrome-extension://',
    'moz-extension://',
    'extensions/',
    'inpage.js',
    'tronlink',
    'backpack',
    'metamask',
    'wallet must has at least one account',
    'wallet must have at least one account',
    'webkit-masked-url://',
    'autofillfielddata.autocompletetype.includes',
    'can\'t find variable: currentinset',
    'can\'t find variable: config',
    'error invoking post',
    'method not found',
    'swal'
  ];

  function toLowerSafe(value) {
    if (value === null || value === undefined) return '';
    return String(value).toLowerCase();
  }

  function includesExtensionKeyword(value) {
    var normalized = toLowerSafe(value);
    if (!normalized) return false;
    return EXTENSION_ERROR_KEYWORDS.some(function(keyword) {
      return normalized.indexOf(keyword) !== -1;
    });
  }

  function isExtensionProviderConflict(payload) {
    if (!payload) return false;

    return includesExtensionKeyword(payload.message) ||
      includesExtensionKeyword(payload.stack) ||
      includesExtensionKeyword(payload.filename) ||
      includesExtensionKeyword(payload.functionName) ||
      includesExtensionKeyword(payload.mechanismType);
  }

  function isGenericObjectRejectionException(exception) {
    if (!exception || typeof exception !== 'object') return false;

    var mechanismType = toLowerSafe(
      exception.mechanism && exception.mechanism.type ? exception.mechanism.type : ''
    );
    if (mechanismType !== 'onunhandledrejection') return false;

    var exceptionValue = toLowerSafe(exception.value);
    return exceptionValue.indexOf('object captured as promise rejection with keys') !== -1 ||
      exceptionValue.indexOf('non-error promise rejection captured with keys') !== -1;
  }

  function collectEventSearchableText(event) {
    var MAX_DEPTH = 4;
    var MAX_CHUNKS = 160;
    var chunks = [];
    var seen = [];

    function pushChunk(value) {
      if (value === null || value === undefined) return;
      if (chunks.length >= MAX_CHUNKS) return;
      chunks.push(String(value));
    }

    function isSeenObject(obj) {
      for (var i = 0; i < seen.length; i++) {
        if (seen[i] === obj) return true;
      }
      return false;
    }

    function walk(value, depth) {
      if (value === null || value === undefined) return;
      if (chunks.length >= MAX_CHUNKS) return;
      if (depth > MAX_DEPTH) return;

      var type = typeof value;
      if (type === 'string' || type === 'number' || type === 'boolean') {
        pushChunk(value);
        return;
      }
      if (type !== 'object') return;

      if (isSeenObject(value)) return;
      seen.push(value);

      if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i++) {
          walk(value[i], depth + 1);
          if (chunks.length >= MAX_CHUNKS) return;
        }
        return;
      }

      var keys = Object.keys(value);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        if (chunks.length >= MAX_CHUNKS) return;
        // 优先采集错误链路核心字段，避免遍历过深影响性能
        if (
          key === 'message' ||
          key === 'value' ||
          key === 'type' ||
          key === 'reason' ||
          key === 'originalException' ||
          key === 'mechanism' ||
          key === 'exception' ||
          key === 'extra' ||
          key === 'breadcrumbs' ||
          key === 'data' ||
          key === 'filename' ||
          key === 'function'
        ) {
          walk(value[key], depth + 1);
          continue;
        }

        if (depth < 2) {
          walk(value[key], depth + 1);
        }
      }
    }

    walk(event, 0);
    return chunks.join('\n');
  }

  function recordExtensionNoise(source, payload) {
    try {
      var store = window[EXTENSION_NOISE_STORE_KEY];
      if (!store || typeof store !== 'object') {
        store = { count: 0, samples: [] };
      }
      if (!Array.isArray(store.samples)) {
        store.samples = [];
      }

      store.count += 1;
      store.lastSource = source;
      store.lastSeenAt = new Date().toISOString();

      var sample = {
        source: source,
        message: toLowerSafe(payload && payload.message).substring(0, 160),
        filename: payload && payload.filename ? String(payload.filename).substring(0, 240) : '',
        mechanismType: toLowerSafe(payload && payload.mechanismType),
        timestamp: store.lastSeenAt
      };

      if (sample.message || sample.filename) {
        if (store.samples.length >= EXTENSION_NOISE_SAMPLE_LIMIT) {
          store.samples.shift();
        }
        store.samples.push(sample);
      }

      window[EXTENSION_NOISE_STORE_KEY] = store;

      if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('sentry-extension-noise-blocked', {
          detail: {
            count: store.count,
            lastSource: source
          }
        }));
      }
    } catch (_) {}
  }

  if (!window.getSentryExtensionNoiseStats) {
    window.getSentryExtensionNoiseStats = function() {
      var store = window[EXTENSION_NOISE_STORE_KEY];
      if (!store || typeof store !== 'object') {
        return { count: 0, samples: [] };
      }
      return store;
    };
  }

  // ===================================
  // Mock 对象（开发环境或加载失败时使用）
  // ===================================
  var SentryMock = {
    init: function() {},
    captureException: function(error) {
      console.error('[Sentry Mock] Exception:', error);
    },
    captureMessage: function(message, level) {
      console.log('[Sentry Mock] ' + (level || 'info') + ':', message);
    },
    addBreadcrumb: function() {},
    setUser: function() {},
    setTag: function() {},
    setContext: function() {},
    withScope: function(callback) {
      callback({ setContext: function() {}, setTag: function() {} });
    },
    browserTracingIntegration: function() { return {}; }
  };

  // ===================================
  // 全局错误拦截（在 SDK 初始化之前）
  // ===================================

  window.addEventListener('unhandledrejection', function(event) {
    var reason = event && event.reason;
    var message = '';
    var stack = '';
    var allReasonText = '';

    if (typeof reason === 'string') {
      message = reason;
      allReasonText = reason;
    } else if (reason && typeof reason === 'object') {
      message = reason.message || reason.toString();
      stack = reason.stack || '';
      // 收集 reason 对象的所有属性值，用于检测钱包扩展冲突
      // 钱包扩展可能 reject {code: 4001, message: "wallet must has at least one account"} 这样的对象
      var reasonValues = [];
      try {
        var keys = Object.keys(reason);
        for (var i = 0; i < keys.length; i++) {
          var val = reason[keys[i]];
          if (val !== null && val !== undefined) {
            reasonValues.push(String(val));
          }
        }
      } catch (e) {
        // 忽略遍历错误
      }
      allReasonText = reasonValues.join(' ');
    }

    // 收集 reason 对象所有属性值（含嵌套），用于扩展关键词检测
    if (reason && typeof reason === 'object' && !allReasonText) {
      try {
        // 优先用 JSON.stringify 序列化整个对象（含嵌套结构）
        // 钱包扩展错误常返回嵌套对象如 { error: { message: "..." } }
        allReasonText = JSON.stringify(reason);
      } catch (_) {
        // 循环引用等情况降级到浅层遍历
        try {
          var reasonValues = [];
          var keys = Object.keys(reason);
          for (var i = 0; i < keys.length; i++) {
            var val = reason[keys[i]];
            if (val !== null && val !== undefined) {
              reasonValues.push(String(val));
            }
          }
          allReasonText = reasonValues.join(' ');
        } catch (err) {}
      }
    }

    // 先检查 message 和 stack 是否包含扩展关键词
    var shouldBlock = isExtensionProviderConflict({
      message: message,
      stack: stack,
      mechanismType: 'onunhandledrejection'
    });

    // 额外检查 reason 对象所有属性值（含嵌套）是否包含扩展关键词
    if (!shouldBlock && allReasonText) {
      shouldBlock = includesExtensionKeyword(allReasonText);
    }

    if (!shouldBlock && event && event.promise) {
      shouldBlock = includesExtensionKeyword(event.promise);
    }

    if (shouldBlock) {
      event.preventDefault();
      recordExtensionNoise('loader-unhandledrejection', {
        message: message,
        mechanismType: 'onunhandledrejection'
      });
      console.debug('[Sentry Filter] 已在 loader 阶段拦截扩展冲突:', {
        message: toLowerSafe(message).substring(0, 100),
        hasStack: !!stack
      });
    }
  }, true);

  window.addEventListener('error', function(event) {
    var error = event && event.error;
    var message = event && event.message ? event.message : '';
    var stack = '';
    var filename = event && event.filename ? event.filename : '';

    if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      message = error.message || message || error.toString();
      stack = error.stack || '';
    }

    if (isExtensionProviderConflict({
      message: message,
      stack: stack,
      filename: filename
    })) {
      event.preventDefault();
      recordExtensionNoise('loader-error', {
        message: message,
        filename: filename
      });
      console.debug('[Sentry Filter] 已在 loader 阶段拦截扩展错误:', {
        message: toLowerSafe(message).substring(0, 100),
        filename: filename
      });
    }
  }, true);

  // ===================================
  // 初始化函数
  // ===================================
  function initSentry() {
    if (sentryInitialized) return;

    if (isDev) {
      console.log('[Sentry] 开发环境，使用 Mock 模式');
      window.Sentry = SentryMock;
      return;
    }

    if (!window.Sentry) {
      console.warn('[Sentry] SDK 未加载，使用 Mock 模式');
      window.Sentry = SentryMock;
      return;
    }

    if (!SENTRY_DSN) {
      console.warn('[Sentry] DSN 未配置，跳过初始化');
      window.Sentry = SentryMock;
      return;
    }

    try {
      window.Sentry.init({
        dsn: SENTRY_DSN,
        environment: SENTRY_ENVIRONMENT,
        release: SENTRY_RELEASE,

        // 性能监控 - 启用完整的请求追踪
        integrations: [
          window.Sentry.browserTracingIntegration({
            // 启用 fetch 和 XHR 请求追踪
            traceFetch: true,
            traceXHR: true,
            // 启用页面加载和导航追踪
            enableLongTask: true
          }),
        ],
        // 追踪传播目标 - 指定哪些请求应该添加追踪头
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/esim\.cosr\.eu\.org/,
          /^https:\/\/.*\.giffgaff\.com/,
          /^https:\/\/.*\.simyo\.nl/,
          /^https:\/\/qrcode\.show/,
          /^https:\/\/api\.qrserver\.com/
        ],
        tracesSampleRate: 0.1,  // 10% 采样率，节省免费配额

        // 错误采样率
        sampleRate: 1.0,

        // 错误过滤 - 仅过滤浏览器扩展和已知噪音
        // 注意：不再过滤网络错误，这些是真实的用户问题
        ignoreErrors: [
          // 浏览器扩展冲突（必须过滤）
          /Cannot redefine property:? ethereum/i,
          /Cannot redefine property/i,
          /redefine property/i,
          /Object\.defineProperty/i,
          /ethereum/i,
          /chrome-extension/i,
          /moz-extension/i,
          /extensions\//i,
          /inpage\.js/i,
          /tronlink/i,
          /backpack/i,
          /metamask/i,
          /wallet must (?:has|have) at least one account/i,
          /webkit-masked-url/i,
          /autofillFieldData\.autoCompleteType\.includes/i,
          /Can't find variable: currentInset/i,
          /Can't find variable: CONFIG/i,
          // Android WebView / 浏览器注入脚本噪音
          /Error invoking post/i,
          /Method not found/i,
          // 浏览器扩展注入 CommonJS require 到纯 ES Module 环境
          /require is not defined/i,
          // 已知浏览器噪音（保留）
          'ResizeObserver loop',
          'Non-Error promise rejection',
          /AbortError/,
          // 第三方脚本噪音
          /turnstile/i,
          // 浏览器扩展注入的 SweetAlert 冲突（t.swal=e() 模式）
          /t\.swal=e\(\)/i,
          // Google Tag Manager 噪音 (ESIM-TOOLS-18)
          /gtag\/js/,
          /gtm\.js/,
          /Unexpected token '<'/,
        ],

        denyUrls: [
          /extensions\//i,
          /^chrome:\/\//i,
          /^moz-extension:\/\//i,
          /^chrome-extension:\/\//i,
          /^webkit-masked-url:\/\//i
        ],

        // 敏感数据过滤 + 诊断日志
        beforeSend: function(event) {
          // 诊断：记录被发送的事件（仅在开发环境或调试时启用）
          var eventMessage = '';
          if (event.exception && event.exception.values && event.exception.values[0]) {
            eventMessage = event.exception.values[0].value || '';
          } else if (event.message) {
            eventMessage = event.message;
          }

          // 1. 仅过滤浏览器扩展错误（更精确的匹配）
          if (event.exception && event.exception.values) {
            for (var i = 0; i < event.exception.values.length; i++) {
              var exception = event.exception.values[i] || {};
              var mechanismType = exception.mechanism && exception.mechanism.type
                ? exception.mechanism.type
                : '';

              // 仅在堆栈帧中明确包含扩展路径时才过滤
              var stacktrace = exception.stacktrace;
              var frames = stacktrace && stacktrace.frames ? stacktrace.frames : [];
              var hasExtensionFrame = false;
              for (var j = 0; j < frames.length; j++) {
                var frame = frames[j] || {};
                var frameFilename = frame.filename || '';
                if (/chrome-extension:\/\//.test(frameFilename) ||
                    /moz-extension:\/\//.test(frameFilename) ||
                    /webkit-masked-url:\/\//.test(frameFilename)) {
                  hasExtensionFrame = true;
                  break;
                }
              }

              if (hasExtensionFrame) {
                recordExtensionNoise('loader-beforeSend-extension-frame', {
                  message: exception.value,
                  mechanismType: mechanismType
                });
                return null;
              }

              // 过滤非 Error 类型的 rejection 对象（如 { code, message }）
              // 这类对象通常是 API 错误响应被直接 reject，不属于代码 bug
              if (mechanismType === 'onunhandledrejection' &&
                  (exception.value || '').indexOf('object captured as promise rejection with keys') !== -1) {
                return null;
              }
            }
          }

          // 1b. 过滤 extra.__serialized__ 中的钱包扩展噪音
          // 非 Error rejection 对象的原始内容存储在 extra.__serialized__，
          // ignoreErrors 正则只能匹配 exception.value（已被 SDK 序列化为通用描述），
          // 无法匹配到原始 rejection 内容，因此需要在此处额外检查
          if (event.extra && event.extra.__serialized__) {
            var serialized = typeof event.extra.__serialized__ === 'string'
              ? event.extra.__serialized__
              : JSON.stringify(event.extra.__serialized__);
            if (includesExtensionKeyword(serialized)) {
              recordExtensionNoise('loader-beforeSend-serialized', {
                message: serialized.substring(0, 160),
                mechanismType: 'onunhandledrejection'
              });
              return null;
            }
          }

          // 2. 脱敏 URL 中的敏感查询参数
          function sanitizeQueryString(url) {
            if (!url) return url;
            var sensitiveParams = ['token', 'key', 'password', 'code', 'state', 'access_token', 'refresh_token', 'auth', 'secret'];
            try {
              var urlObj = new URL(url, window.location.origin);
              sensitiveParams.forEach(function(param) {
                if (urlObj.searchParams.has(param)) {
                  urlObj.searchParams.set(param, '***');
                }
              });
              return urlObj.toString();
            } catch (e) {
              return url.replace(/([?&])(token|key|password|code|state|access_token|refresh_token|auth|secret)=[^&]*/gi, '$1$2=***');
            }
          }

          if (event.request) {
            if (event.request.query_string) {
              event.request.query_string = event.request.query_string
                .replace(/(token|key|password|code|state|access_token|refresh_token|auth|secret)=[^&]*/gi, '$1=***');
            }
            if (event.request.url) {
              event.request.url = sanitizeQueryString(event.request.url);
            }
            delete event.request.cookies;
            if (event.request.headers) {
              delete event.request.headers['authorization'];
              delete event.request.headers['x-esim-key'];
              delete event.request.headers['cookie'];
            }
          }

          // 3. 脱敏异常消息中的敏感信息
          if (event.exception && event.exception.values) {
            event.exception.values.forEach(function(exception) {
              if (exception.value) {
                exception.value = exception.value
                  .replace(/token[=:]\s*[^\s,]+/gi, 'token=***')
                  .replace(/key[=:]\s*[^\s,]+/gi, 'key=***')
                  .replace(/password[=:]\s*[^\s,]+/gi, 'password=***')
                  .replace(/cookie[=:]\s*[^\s,]+/gi, 'cookie=***')
                  .replace(/code[=:]\s*[^\s,]+/gi, 'code=***')
                  .replace(/state[=:]\s*[^\s,]+/gi, 'state=***')
                  .replace(/access_token[=:]\s*[^\s,]+/gi, 'access_token=***')
                  .replace(/refresh_token[=:]\s*[^\s,]+/gi, 'refresh_token=***');
              }
            });
          }

          return event;
        }
      });

      sentryInitialized = true;
      console.log('[Sentry] 前端初始化成功');
      console.log('[Sentry] Environment:', SENTRY_ENVIRONMENT);
      console.log('[Sentry] Release:', SENTRY_RELEASE);
    } catch (error) {
      console.error('[Sentry] 初始化失败:', error);
      window.Sentry = SentryMock;
    }
  }

  // ===================================
  // 测试函数
  // ===================================
  function testSentry() {
    console.log('[Sentry Test] 开始测试...');
    console.log('[Sentry Test] SDK 已加载:', !!window.Sentry && window.Sentry !== SentryMock);
    console.log('[Sentry Test] 已初始化:', sentryInitialized);
    console.log('[Sentry Test] 开发环境:', isDev);
    console.log('[Sentry Test] DSN 已配置:', !!SENTRY_DSN);

    if (sentryInitialized && !isDev && window.Sentry && window.Sentry !== SentryMock) {
      window.Sentry.captureMessage('Sentry 测试消息 - 前端集成正常', 'info');
      console.log('[Sentry Test] ✅ 已发送测试消息到 Sentry');
      return true;
    } else {
      console.log('[Sentry Test] ⚠️ Mock 模式，消息不会发送到 Sentry');
      if (window.Sentry) {
        window.Sentry.captureMessage('测试消息 (Mock)', 'info');
      }
      return false;
    }
  }

  // 暴露测试函数到全局
  window.testSentry = testSentry;

  // ===================================
  // 开发环境：立即设置 Mock
  // ===================================
  if (isDev) {
    console.log('[Sentry Loader] 开发环境，跳过 SDK 加载');
    window.Sentry = SentryMock;
    return;
  }

  // ===================================
  // 生产环境：加载 SDK
  // ===================================

  // Sentry SDK URL - 使用官方 CDN（带 tracing 和 replay）
  var SENTRY_SDK_URL = 'https://browser.sentry-cdn.com/8.40.0/bundle.tracing.min.js';

  // 创建 script 标签
  var script = document.createElement('script');
  script.src = SENTRY_SDK_URL;
  // 本地资源不需要 crossOrigin
  script.async = true;

  script.onload = function() {
    console.log('[Sentry Loader] SDK 加载成功');
    // 加载成功后立即初始化
    initSentry();
    // 触发自定义事件，通知其他模块 SDK 已加载
    window.dispatchEvent(new Event('sentry-sdk-loaded'));
  };

  script.onerror = function() {
    console.warn('[Sentry Loader] SDK 加载失败，使用 Mock 模式');
    window.Sentry = SentryMock;
  };

  // 插入到当前脚本之后（确保配置已读取）
  var currentScript = document.currentScript;
  if (currentScript && currentScript.parentNode) {
    currentScript.parentNode.insertBefore(script, currentScript.nextSibling);
  } else {
    document.head.appendChild(script);
  }

  // 设置超时回退
  setTimeout(function() {
    if (!sentryInitialized && !isDev) {
      console.warn('[Sentry] SDK 加载超时，使用 Mock 模式');
      if (!window.Sentry) {
        window.Sentry = SentryMock;
      }
    }
  }, 10000);

})();
