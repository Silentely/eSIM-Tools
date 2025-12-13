/**
 * Sentry 前端监控初始化模块 (CDN 版本)
 *
 * 职责：
 * - 环境检测（仅生产环境启用）
 * - 错误追踪和性能监控
 * - 敏感数据过滤
 * - 用户上下文管理
 *
 * @module sentry-init
 *
 * 使用方式：
 * 1. 在 HTML <head> 中加载 Sentry CDN (由 sentry-loader.js 自动处理)
 * 2. 导入此模块进行初始化
 */

// ===================================
// 环境检测
// ===================================

/**
 * 检测是否为开发环境
 */
const isDev = (() => {
  if (typeof window === 'undefined') return true;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
})();

// ===================================
// Sentry 配置
// ===================================

// 从 window 获取配置（由 HTML 中的内联脚本设置）
const SENTRY_DSN = window.SENTRY_DSN || '';
const SENTRY_ENVIRONMENT = window.SENTRY_ENVIRONMENT || 'production';
const SENTRY_RELEASE = window.SENTRY_RELEASE || 'esim-tools@unknown';

// ===================================
// Sentry 初始化
// ===================================

let sentryInitialized = false;

/**
 * 初始化 Sentry（在 Sentry SDK 加载后调用）
 */
function initSentry() {
  if (isDev) {
    console.log('[Sentry] 开发环境，使用 Mock 模式');
    window.Sentry = SentryMock;
    return;
  }

  if (!window.Sentry) {
    console.warn('[Sentry] SDK 未加载，跳过初始化');
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
        window.Sentry.browserTracingIntegration(),
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
        /moz-extension/,
      ],

      denyUrls: [
        /extensions\//i,
        /^chrome:\/\//i,
        /^moz-extension:\/\//i,
      ],

      // 敏感数据过滤
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['x-esim-key'];
            delete event.request.headers['cookie'];
          }
        }

        if (event.exception?.values) {
          event.exception.values.forEach(exception => {
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
      },
    });

    sentryInitialized = true;
    console.log('[Sentry] 前端初始化成功');
  } catch (error) {
    console.error('[Sentry] 初始化失败:', error);
    window.Sentry = SentryMock;
  }
}

// ===================================
// Mock 对象（开发环境使用）
// ===================================

const SentryMock = {
  init: () => {},
  captureException: (error) => {
    console.error('[Sentry Dev] Exception:', error);
  },
  captureMessage: (message, level) => {
    console.log(`[Sentry Dev] ${level || 'info'}:`, message);
  },
  addBreadcrumb: () => {},
  setUser: () => {},
  setTag: () => {},
  setContext: () => {},
  withScope: (callback) => callback({ setContext: () => {}, setTag: () => {} }),
  browserTracingIntegration: () => ({}),
};

// ===================================
// 自动初始化
// ===================================

// 如果 Sentry SDK 已加载，立即初始化
if (typeof window !== 'undefined') {
  if (window.Sentry && window.Sentry.init) {
    initSentry();
  } else {
    // 等待 SDK 加载
    window.addEventListener('sentry-sdk-loaded', initSentry);
    // 设置超时回退
    setTimeout(() => {
      if (!sentryInitialized) {
        console.warn('[Sentry] SDK 加载超时，使用 Mock 模式');
        window.Sentry = SentryMock;
      }
    }, 5000);
  }
}

// ===================================
// 导出 Helper 函数
// ===================================

/**
 * 获取 Sentry 实例
 */
export function getSentry() {
  return window.Sentry || SentryMock;
}

/**
 * 设置用户上下文
 */
export function setUser(userId, email) {
  getSentry().setUser({ id: userId, email });
}

/**
 * 清除用户上下文
 */
export function clearUser() {
  getSentry().setUser(null);
}

/**
 * 手动捕获异常
 */
export function captureException(error, context) {
  const sentry = getSentry();
  if (context) {
    sentry.withScope(scope => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      sentry.captureException(error);
    });
  } else {
    sentry.captureException(error);
  }
}

/**
 * 手动捕获消息
 */
export function captureMessage(message, level = 'info') {
  getSentry().captureMessage(message, level);
}

/**
 * 测试 Sentry 是否正常工作
 */
export function testSentry() {
  const sentry = getSentry();
  console.log('[Sentry Test] 开始测试...');
  console.log('[Sentry Test] SDK 已加载:', !!window.Sentry);
  console.log('[Sentry Test] 已初始化:', sentryInitialized);
  console.log('[Sentry Test] 开发环境:', isDev);
  console.log('[Sentry Test] DSN 已配置:', !!SENTRY_DSN);

  if (sentryInitialized && !isDev) {
    sentry.captureMessage('Sentry 测试消息 - 前端集成正常', 'info');
    console.log('[Sentry Test] ✅ 已发送测试消息到 Sentry');
  } else {
    console.log('[Sentry Test] ⚠️ Mock 模式，消息不会发送到 Sentry');
    sentry.captureMessage('测试消息 (Mock)', 'info');
  }
}

// 暴露测试函数到全局
if (typeof window !== 'undefined') {
  window.testSentry = testSentry;
}

export default { getSentry, setUser, clearUser, captureException, captureMessage, testSentry };
