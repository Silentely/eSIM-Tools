/**
 * Sentry 后端监控模块 (Netlify Functions)
 *
 * 职责：
 * - 环境检测（仅生产环境启用）
 * - Functions 错误追踪
 * - 敏感数据过滤
 * - Handler 包装器
 *
 * @module sentry
 */

'use strict';

const Sentry = require('@sentry/node');

// ===================================
// 环境检测
// ===================================

const isDev = process.env.NODE_ENV !== 'production';

// ===================================
// Sentry 初始化（仅生产环境）
// ===================================

let sentryInitialized = false;

if (!isDev) {
  const sentryDsn = process.env.SENTRY_DSN || '';
  // SENTRY_RELEASE: 优先环境变量，其次 Netlify COMMIT_REF (短哈希)，最后回退默认值
  const commitRef = process.env.COMMIT_REF;
  const sentryRelease = process.env.SENTRY_RELEASE ||
    (commitRef ? `esim-tools@${commitRef.slice(0, 7)}` : 'esim-tools@unknown');
  const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || 'production';

  if (!sentryDsn) {
    console.warn('[Sentry] SENTRY_DSN 未配置，跳过后端初始化');
  } else {
    try {
      Sentry.init({
        dsn: sentryDsn,
        environment: sentryEnvironment,
        release: sentryRelease,

        // 性能采样率
        tracesSampleRate: 0.1,

        // 错误采样率
        sampleRate: 1.0,

        // ===================================
        // 错误过滤
        // ===================================
        ignoreErrors: [
          // 网络相关错误
          'ECONNREFUSED',
          'ETIMEDOUT',
          'ENOTFOUND',
          'socket hang up',
        ],

        // ===================================
        // 事件前处理（移除敏感数据）
        // ===================================
        beforeSend(event) {
          // 移除请求中的敏感数据
          if (event.request) {
            delete event.request.cookies;

            if (event.request.headers) {
              delete event.request.headers['authorization'];
              delete event.request.headers['x-esim-key'];
              delete event.request.headers['cookie'];
            }

            // 脱敏请求体中的敏感字段
            if (event.request.data && typeof event.request.data === 'string') {
              try {
                const body = JSON.parse(event.request.data);
                if (body.authKey) body.authKey = '***';
                if (body.token) body.token = '***';
                if (body.password) body.password = '***';
                if (body.cookie) body.cookie = '***';
                event.request.data = JSON.stringify(body);
              } catch (_) {
                // 不是 JSON，跳过
              }
            }
          }

          // 脱敏异常消息
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
      console.log('[Sentry] 后端初始化成功');
    } catch (error) {
      console.error('[Sentry] 后端初始化失败:', error);
      sentryInitialized = false;
    }
  }
}

// ===================================
// Mock 对象（开发环境使用）
// ===================================

const SentryMock = {
  captureException: (error) => {
    console.error('[Sentry Dev] Exception:', error);
  },
  captureMessage: (message, level) => {
    console.log(`[Sentry Dev] ${level || 'info'}:`, message);
  },
  setTag: () => {},
  setContext: () => {},
  setUser: () => {},
  withScope: (callback) => callback({ setContext: () => {}, setTag: () => {} }),
  flush: () => Promise.resolve(true),
};

// 导出 Sentry 实例
const SentryInstance = (isDev || !sentryInitialized) ? SentryMock : Sentry;

/**
 * 捕获异常并上报到 Sentry
 * @param {Error} error - 错误对象
 * @param {object} [context] - 额外上下文
 */
function captureException(error, context) {
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
 * 捕获消息并上报到 Sentry
 * @param {string} message - 消息内容
 * @param {string} [level] - 级别
 */
function captureMessage(message, level = 'info') {
  SentryInstance.captureMessage(message, level);
}

/**
 * 刷新 Sentry 队列（确保错误发送完成）
 * @param {number} [timeout=2000] - 超时时间（毫秒）
 * @returns {Promise<boolean>}
 */
async function flush(timeout = 2000) {
  if (isDev || !sentryInitialized) {
    return true;
  }
  return Sentry.flush(timeout);
}

/**
 * 设置标签
 * @param {string} key - 标签名
 * @param {string} value - 标签值
 */
function setTag(key, value) {
  SentryInstance.setTag(key, value);
}

/**
 * 设置上下文
 * @param {string} name - 上下文名称
 * @param {object} context - 上下文数据
 */
function setContext(name, context) {
  SentryInstance.setContext(name, context);
}

module.exports = {
  Sentry: SentryInstance,
  captureException,
  captureMessage,
  flush,
  setTag,
  setContext,
  isDev,
  sentryInitialized,
};
