/**
 * Sentry 前端监控初始化模块
 *
 * 职责：
 * - 环境检测（仅生产环境启用）
 * - 错误追踪和性能监控
 * - 敏感数据过滤
 * - 用户上下文管理
 *
 * @module sentry-init
 *
 * 注意事项：
 * - 此模块通过 Webpack 打包 @sentry/browser npm 包
 * - Webpack DefinePlugin 会替换 process.env.* 为实际环境变量值
 * - 使用 SDK v8+ API (browserTracingIntegration)
 */

import * as Sentry from '@sentry/browser';

// ===================================
// 环境检测
// ===================================

/**
 * 检测是否为开发环境
 * 开发环境包括：
 * 1. NODE_ENV === 'development' 或 'test'
 * 2. localhost 访问
 */
const isDev = (() => {
  // Webpack DefinePlugin 会替换 process.env.NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'production';

  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return true;
  }

  // 浏览器 localhost 访问也视为开发环境
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return true;
  }

  return false;
})();

// ===================================
// Sentry 初始化（仅生产环境）
// ===================================

let sentryInitialized = false;

if (!isDev) {
  const sentryDsn = process.env.SENTRY_DSN || '';
  const sentryRelease = process.env.SENTRY_RELEASE || 'esim-tools@unknown';
  const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || 'production';

  if (!sentryDsn) {
    console.warn('[Sentry] SENTRY_DSN 未配置，跳过初始化');
  } else {
    try {
      Sentry.init({
        dsn: sentryDsn,
        environment: sentryEnvironment,
        release: sentryRelease,

        // ===================================
        // 性能监控配置 (SDK v8+ API)
        // ===================================
        integrations: [
          Sentry.browserTracingIntegration({
            // 追踪页面导航
            tracePropagationTargets: [
              'localhost',
              'esim.cosr.eu.org',
              /^\//,  // 相对路径
            ],
          }),
        ],

        // 性能采样率（10% = 节省配额）
        tracesSampleRate: 0.1,

        // 错误采样率（100% = 全部错误）
        sampleRate: 1.0,

        // ===================================
        // 错误过滤
        // ===================================
        ignoreErrors: [
          // 浏览器内部错误
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',

          // 非标准 Promise 拒绝
          'Non-Error promise rejection captured',

          // 网络相关错误（不可控）
          'Network request failed',
          'Failed to fetch',
          'NetworkError',
          'Load failed',

          // 浏览器扩展引起的错误
          'Extension context invalidated',
          'chrome-extension://',
          'moz-extension://',
        ],

        // ===================================
        // 面包屑过滤（Breadcrumb）
        // ===================================
        beforeBreadcrumb(breadcrumb) {
          // 过滤 console 日志（避免日志泄露）
          if (breadcrumb.category === 'console') {
            return null;
          }

          // 过滤导航到外部链接
          if (breadcrumb.category === 'navigation' && breadcrumb.data?.to) {
            const url = breadcrumb.data.to;
            if (url.startsWith('http') && !url.includes('esim.cosr.eu.org')) {
              return null;
            }
          }

          return breadcrumb;
        },

        // ===================================
        // 事件前处理（移除敏感数据）
        // ===================================
        beforeSend(event) {
          // 移除请求中的敏感数据
          if (event.request) {
            delete event.request.cookies;

            if (event.request.headers) {
              delete event.request.headers['Authorization'];
              delete event.request.headers['X-Esim-Key'];
              delete event.request.headers['Cookie'];
            }

            // 脱敏查询参数中的 Token
            if (event.request.query_string) {
              event.request.query_string = event.request.query_string
                .replace(/token=[^&]+/gi, 'token=***')
                .replace(/key=[^&]+/gi, 'key=***')
                .replace(/code=[^&]+/gi, 'code=***');
            }
          }

          // 脱敏异常消息中的敏感信息
          if (event.exception?.values) {
            event.exception.values.forEach(exception => {
              if (exception.value) {
                exception.value = exception.value
                  .replace(/token[=:]\s*[^\s,]+/gi, 'token=***')
                  .replace(/key[=:]\s*[^\s,]+/gi, 'key=***')
                  .replace(/password[=:]\s*[^\s,]+/gi, 'password=***');
              }
            });
          }

          return event;
        },
      });

      sentryInitialized = true;
      console.log('[Sentry] 初始化成功');
    } catch (error) {
      console.error('[Sentry] 初始化失败:', error);
      sentryInitialized = false;
    }
  }
}

// ===================================
// Mock 对象（开发环境或初始化失败时使用）
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
  withScope: (callback) => callback({ setContext: () => {} }),
};

// 导出 Sentry 实例
const SentryInstance = (isDev || !sentryInitialized) ? SentryMock : Sentry;

// 暴露到全局变量
if (typeof window !== 'undefined') {
  window.Sentry = SentryInstance;
}

export default SentryInstance;

// ===================================
// Helper 函数
// ===================================

/**
 * 设置用户上下文（登录后调用）
 * @param {string} userId - 用户 ID
 * @param {string} [email] - 用户邮箱（可选）
 */
export function setUser(userId, email) {
  if (isDev) return;

  SentryInstance.setUser({
    id: userId,
    email: email,
  });
}

/**
 * 清除用户上下文（登出时调用）
 */
export function clearUser() {
  if (isDev) return;

  SentryInstance.setUser(null);
}

/**
 * 设置自定义标签（用于筛选和分组）
 * @param {string} key - 标签名
 * @param {string} value - 标签值
 */
export function setTag(key, value) {
  if (isDev) return;

  SentryInstance.setTag(key, value);
}

/**
 * 设置自定义上下文（附加元数据）
 * @param {string} name - 上下文名称
 * @param {object} context - 上下文数据
 */
export function setContext(name, context) {
  if (isDev) return;

  SentryInstance.setContext(name, context);
}

/**
 * 手动捕获异常
 * @param {Error} error - 错误对象
 * @param {object} [context] - 额外上下文
 */
export function captureException(error, context) {
  if (isDev) {
    console.error('[Sentry Dev] Exception:', error, context);
    return;
  }

  if (context) {
    SentryInstance.withScope(scope => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      SentryInstance.captureException(error);
    });
  } else {
    SentryInstance.captureException(error);
  }
}

/**
 * 手动捕获消息
 * @param {string} message - 消息内容
 * @param {string} [level] - 级别 (fatal|error|warning|info|debug)
 */
export function captureMessage(message, level = 'info') {
  if (isDev) {
    console.log(`[Sentry Dev] ${level.toUpperCase()}:`, message);
    return;
  }

  SentryInstance.captureMessage(message, level);
}

/**
 * 添加面包屑（用于错误追溯）
 * @param {object} breadcrumb - 面包屑数据
 */
export function addBreadcrumb(breadcrumb) {
  if (isDev) return;

  SentryInstance.addBreadcrumb({
    level: 'info',
    ...breadcrumb,
  });
}
