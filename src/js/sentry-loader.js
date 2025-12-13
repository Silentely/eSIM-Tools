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

        // 性能监控
        integrations: [
          window.Sentry.browserTracingIntegration()
        ],
        tracesSampleRate: 0.1,

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
          if (event.request) {
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
                  .replace(/cookie[=:]\s*[^\s,]+/gi, 'cookie=***');
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

  // Sentry SDK CDN URL (v8.x) - 使用 jsDelivr 镜像（国内访问更快）
  var SENTRY_SDK_URL = 'https://cdn.jsdelivr.net/npm/@sentry/browser@8.40.0/build/bundles/bundle.tracing.min.js';

  // 创建 script 标签
  var script = document.createElement('script');
  script.src = SENTRY_SDK_URL;
  script.crossOrigin = 'anonymous';
  script.async = true;

  script.onload = function() {
    console.log('[Sentry Loader] SDK 加载成功');
    // 加载成功后立即初始化
    initSentry();
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
