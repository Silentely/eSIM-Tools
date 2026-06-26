/**
 * 服务端结构化日志模块
 *
 * 为 Netlify Functions (Node.js 运行时) 提供统一的日志输出。
 * 控制台输出人类可读格式，方便用户查看和复制给开发者排查。
 * 同时附带结构化 JSON 数据，便于日志系统解析。
 *
 * 输出格式:
 * [INFO] [fn-name] [req-uuid] message | key=value key=value
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
   * 构建人类可读日志并输出
   * 格式: [LEVEL] [function] [requestId] message | key=value key=value
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} [context] - 附加字段
   * @param {Function} [outputFn] - 输出函数（默认 console.log）
   */
  function log(level, message, context = {}, outputFn) {
    if (LOG_LEVELS[level] < getCurrentLevel()) return;

    // 构建人类可读的附加字段（key=value 格式，方便复制给开发者）
    const pairs = context && typeof context === 'object'
      ? Object.entries(context).map(([k, v]) => `${k}=${v}`).join(' ')
      : '';

    const line = pairs
      ? `[${level}] [${functionName}] [${requestId}] ${message} | ${pairs}`
      : `[${level}] [${functionName}] [${requestId}] ${message}`;

    outputFn(line);
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
