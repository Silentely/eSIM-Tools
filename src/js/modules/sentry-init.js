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
// 全局错误拦截（在 Sentry 之前）
// ===================================

const EXTENSION_NOISE_STORE_KEY = '__sentryExtensionNoiseStats';
const EXTENSION_NOISE_SAMPLE_LIMIT = 20;
const EXTENSION_ERROR_KEYWORDS = [
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
];

function toLowerSafe(value) {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
}

function includesExtensionKeyword(value) {
  const normalized = toLowerSafe(value);
  if (!normalized) return false;
  return EXTENSION_ERROR_KEYWORDS.some(keyword => normalized.includes(keyword));
}

function isExtensionProviderConflict({
  message = '',
  stack = '',
  filename = '',
  functionName = '',
  mechanismType = '',
} = {}) {
  return includesExtensionKeyword(message) ||
    includesExtensionKeyword(stack) ||
    includesExtensionKeyword(filename) ||
    includesExtensionKeyword(functionName) ||
    includesExtensionKeyword(mechanismType);
}

function recordExtensionNoise(source, payload = {}) {
  try {
    const store = window[EXTENSION_NOISE_STORE_KEY] || { count: 0, samples: [] };
    if (!Array.isArray(store.samples)) {
      store.samples = [];
    }

    store.count += 1;
    store.lastSource = source;
    store.lastSeenAt = new Date().toISOString();

    const sample = {
      source,
      message: toLowerSafe(payload.message).substring(0, 160),
      filename: toLowerSafe(payload.filename).substring(0, 240),
      mechanismType: toLowerSafe(payload.mechanismType),
      timestamp: store.lastSeenAt,
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
          lastSource: source,
        },
      }));
    }
  } catch (_) {}
}

if (typeof window !== 'undefined' && !window.getSentryExtensionNoiseStats) {
  window.getSentryExtensionNoiseStats = () => {
    const store = window[EXTENSION_NOISE_STORE_KEY];
    if (!store || typeof store !== 'object') {
      return { count: 0, samples: [] };
    }
    return store;
  };
}

/**
 * 在 Sentry 捕获之前拦截浏览器扩展相关的错误
 * 这是最强的防护层，确保扩展错误不会污染 Sentry 日志
 */
if (typeof window !== 'undefined') {
  // 拦截 unhandledrejection 事件
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;

    let message = '';
    let stack = '';

    if (typeof reason === 'string') {
      message = reason;
    } else if (reason && typeof reason === 'object') {
      message = reason.message || reason.toString();
      stack = reason.stack || '';
    }

    let shouldBlock = isExtensionProviderConflict({
      message,
      stack,
      mechanismType: 'onunhandledrejection',
    });

    if (!shouldBlock && event.promise) {
      shouldBlock = includesExtensionKeyword(event.promise);
    }

    if (shouldBlock) {
      event.preventDefault();
      recordExtensionNoise('init-unhandledrejection', {
        message,
        mechanismType: 'onunhandledrejection',
      });
      console.debug('[Sentry Filter] 已拦截浏览器扩展错误:', {
        message: toLowerSafe(message).substring(0, 100),
        type: typeof reason,
        hasStack: !!stack,
      });
    }
  }, true);  // 使用捕获阶段，确保最早执行

  // 拦截 error 事件
  window.addEventListener('error', (event) => {
    const error = event.error;
    let message = event.message || '';
    let stack = '';
    const filename = event.filename || '';

    if (error) {
      if (typeof error === 'string') {
        message = error;
      } else if (typeof error === 'object') {
        message = error.message || message || error.toString();
        stack = error.stack || '';
      }
    }

    if (isExtensionProviderConflict({ message, stack, filename })) {
      event.preventDefault();
      recordExtensionNoise('init-error', { message, filename });
      console.debug('[Sentry Filter] 已拦截浏览器扩展错误:', {
        message: toLowerSafe(message).substring(0, 100),
        filename,
        hasStack: !!stack,
      });
    }
  }, true);  // 使用捕获阶段，确保最早执行
}

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
        // 浏览器扩展冲突（增强版）
        /Cannot redefine property:? ethereum/i,
        /Cannot redefine property/i,
        /redefine property/i,
        /defineProperty/i,
        /Object\.defineProperty/i,
        /ethereum/i,
        // 浏览器扩展通用错误
        /chrome-extension/i,
        /moz-extension/i,
        /extensions\//i,
        /inpage\.js/i,
        // TronLink 和其他钱包扩展
        /tronlink/i,
        /backpack/i,
        /metamask/i,
        // 网络相关错误
        /ResizeObserver loop/,
        /Non-Error promise rejection/,
        /Loading chunk .* failed/,
        /Network request failed/,
        /Failed to fetch/,
        /Load failed/,
        /AbortError/,
        /Error invoking post/,
        /Method not found/,
        // 第三方服务错误
        /turnstile/i,
        /postMessage/i,
      ],

      denyUrls: [
        // 浏览器扩展
        /extensions\//i,
        /^chrome:\/\//i,
        /^moz-extension:\/\//i,
        /^chrome-extension:\/\//i,
      ],

      // 敏感数据过滤和浏览器扩展错误过滤
      beforeSend(event) {
        // 1. 过滤浏览器扩展相关错误
        if (event.exception?.values) {
          for (const exception of event.exception.values) {
            const mechanismType = exception?.mechanism?.type || '';
            if (isExtensionProviderConflict({
              message: exception.value,
              mechanismType,
            })) {
              recordExtensionNoise('init-beforeSend-exception', {
                message: exception.value,
                mechanismType,
              });
              console.debug('[Sentry beforeSend] 已拦截扩展错误:', exception.value);
              return null;
            }

            // 检查堆栈帧 URL 与函数名
            if (exception.stacktrace?.frames) {
              for (const frame of exception.stacktrace.frames) {
                if (isExtensionProviderConflict({
                  filename: frame.filename,
                  functionName: frame.function,
                })) {
                  recordExtensionNoise('init-beforeSend-frame', {
                    filename: frame.filename,
                    message: frame.function,
                  });
                  console.debug('[Sentry beforeSend] 已拦截扩展堆栈:', frame.filename || frame.function);
                  return null;
                }
              }
            }
          }
        }

        // 2. 删除敏感请求数据
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['x-esim-key'];
            delete event.request.headers['cookie'];
          }
        }

        // 3. 脱敏异常消息中的敏感信息
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
