/**
 * 服务端结构化日志模块
 *
 * 为 Netlify Functions (Node.js 运行时) 提供统一的 JSON 格式日志输出。
 * 输出为单行 JSON，便于 Netlify 日志流解析和搜索。
 *
 * 日志格式:
 * {"level":"INFO","message":"...","function":"fn-name","requestId":"uuid","timestamp":"ISO","...context"}
 *
 * @module server-logger
 */

'use strict';

/**
 * 日志级别数值映射（数值越高越严格）
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * 解析日志级别字符串为数值
 * @param {string|undefined} level - 日志级别字符串
 * @returns {number} 级别数值（未知值默认为 INFO=1）
 */
function parseLogLevel(level) {
  if (level && LOG_LEVELS[level] !== undefined) {
    return LOG_LEVELS[level];
  }
  return LOG_LEVELS.INFO;
}

// 动态读取当前环境日志级别（支持运行时变更和测试覆盖）
function getCurrentLevel() {
  return parseLogLevel(process.env.LOG_LEVEL);
}

/**
 * 创建结构化日志实例
 *
 * @param {string} functionName - Function 名称（如 'giffgaff-graphql'）
 * @param {string} requestId - 请求 ID（由中间件生成的 UUID）
 * @returns {{ info: Function, warn: Function, error: Function, debug: Function }}
 */
function createLogger(functionName, requestId) {
  /**
   * 构建日志对象并输出
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} [context] - 附加字段
   * @param {Function} [outputFn] - 输出函数（默认 console.log）
   */
  function log(level, message, context, outputFn) {
    if (LOG_LEVELS[level] < getCurrentLevel()) return;

    const entry = {
      level,
      message,
      function: functionName,
      requestId,
      timestamp: new Date().toISOString(),
    };

    if (context && typeof context === 'object') {
      Object.assign(entry, context);
    }

    outputFn(JSON.stringify(entry));
  }

  return {
    /**
     * INFO 级别日志（始终输出）
     * 用于记录关键业务节点和正常流程
     */
    info: (message, context) => log('INFO', message, context, console.log),

    /**
     * WARN 级别日志（始终输出）
     * 用于记录非致命性问题和降级情况
     */
    warn: (message, context) => log('WARN', message, context, console.warn),

    /**
     * ERROR 级别日志（始终输出）
     * 用于记录错误和异常
     */
    error: (message, context) => log('ERROR', message, context, console.error),

    /**
     * DEBUG 级别日志（仅 LOG_LEVEL=DEBUG 时输出）
     * 用于开发调试信息
     */
    debug: (message, context) => log('DEBUG', message, context, console.log),
  };
}

module.exports = { createLogger, parseLogLevel, LOG_LEVELS };
