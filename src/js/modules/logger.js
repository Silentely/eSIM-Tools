/**
 * 日志工具模块
 * 生产环境禁用console.log，开发环境保留
 */

const isDev = typeof process !== 'undefined' ?
  process.env.NODE_ENV === 'development' :
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

class Logger {
  /**
   * 信息日志(生产环境禁用)
   */
  static log(...args) {
    if (isDev) {
      console.log('[INFO]', ...args);
    }
  }

  /**
   * 警告日志(生产环境保留)
   */
  static warn(...args) {
    console.warn('[WARN]', ...args);
  }

  /**
   * 错误日志(生产环境保留)
   */
  static error(...args) {
    console.error('[ERROR]', ...args);
  }

  /**
   * 调试日志(生产环境禁用)
   */
  static debug(...args) {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * 敏感数据脱敏记录
   * @param {string} label - 标签
   * @param {string} value - 敏感值
   * @param {number} visibleChars - 可见字符数
   */
  static sensitive(label, value, visibleChars = 5) {
    if (!isDev) return;

    if (!value || typeof value !== 'string') {
      console.log(`[SENSITIVE] ${label}: (empty)`);
      return;
    }

    const masked = value.length > visibleChars ?
      `${value.substring(0, visibleChars)}${'*'.repeat(Math.min(value.length - visibleChars, 20))}` :
      '***';

    console.log(`[SENSITIVE] ${label}: ${masked} (length: ${value.length})`);
  }

  /**
   * 性能计时
   * @param {string} label - 计时标签
   */
  static time(label) {
    if (isDev) {
      console.time(label);
    }
  }

  /**
   * 结束计时
   * @param {string} label - 计时标签
   */
  static timeEnd(label) {
    if (isDev) {
      console.timeEnd(label);
    }
  }

  /**
   * 表格输出
   * @param {Array|Object} data - 数据
   */
  static table(data) {
    if (isDev && console.table) {
      console.table(data);
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
} else if (typeof window !== 'undefined') {
  window.Logger = Logger;
}

export default Logger;
