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
          })
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

        // 错误过滤
        ignoreErrors: [
          'ResizeObserver loop',
          'Non-Error promise rejection',
          /Loading chunk .* failed/,
          /Network request failed/,
          /Failed to fetch/,
          /Load failed/,
          /AbortError/,
          /chrome-extension/,
          /moz-extension/
        ],

        denyUrls: [
          /extensions\//i,
          /^chrome:\/\//i,
          /^moz-extension:\/\//i
        ],

        // 敏感数据过滤
        beforeSend: function(event) {
          // 脱敏 URL 中的敏感查询参数
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
              // URL 解析失败，使用正则替换
              return url.replace(/([?&])(token|key|password|code|state|access_token|refresh_token|auth|secret)=[^&]*/gi, '$1$2=***');
            }
          }

          if (event.request) {
            // 脱敏 query_string
            if (event.request.query_string) {
              event.request.query_string = event.request.query_string
                .replace(/(token|key|password|code|state|access_token|refresh_token|auth|secret)=[^&]*/gi, '$1=***');
            }
            // 脱敏 URL
            if (event.request.url) {
              event.request.url = sanitizeQueryString(event.request.url);
            }
            // 删除敏感 cookies 和 headers
            delete event.request.cookies;
            if (event.request.headers) {
              delete event.request.headers['authorization'];
              delete event.request.headers['x-esim-key'];
              delete event.request.headers['cookie'];
            }
          }

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

  // Sentry SDK URL (v8.x) - 使用本地托管的 bundle（避免国内 CDN 访问问题）
  var SENTRY_SDK_URL = '/src/assets/vendor/sentry-8.40.0.bundle.tracing.min.js';

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
