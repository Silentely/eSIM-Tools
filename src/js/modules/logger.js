/**
 * 日志工具模块
 * 生产环境禁用console.log，开发环境保留
 */

function detectDev() {
  // Node / 测试 / 构建注入：严格以 NODE_ENV === 'development' 为准
  // （test / production 均视为非开发，避免 Jest 误开 debug 输出）
  if (typeof process !== 'undefined' && process.env && typeof process.env.NODE_ENV === 'string') {
    return process.env.NODE_ENV === 'development';
  }
  // 纯浏览器（无 process 注入）：与 sentry-loader 开发判定保持一致
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || '';
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname.startsWith('192.168.');
  }
  return false;
}

const isDev = detectDev();

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

  /**
   * 读取构建/Sentry 注入的发布版本（与 Sentry Release 一致）
   * @returns {string}
   */
  static getRelease() {
    if (typeof window !== 'undefined' && window.SENTRY_RELEASE) {
      return String(window.SENTRY_RELEASE);
    }
    return 'esim-tools@unknown';
  }

  /**
   * 输出环境信息（启动时调用一次）
   * 生产环境：仅输出关键排错信息（不含敏感数据）
   * 开发环境：输出完整信息
   */
  static env() {
    if (typeof window === 'undefined') return;

    const release = Logger.getRelease();

    if (isDev) {
      // 开发环境：完整信息
      console.groupCollapsed('%c[ENV] 环境信息', 'color: #6366f1; font-weight: bold');
      console.log('Release:', release);
      console.log('时间:', new Date().toISOString());
      console.log('主机:', window.location.hostname);
      console.log('协议:', window.location.protocol);
      console.log('语言:', navigator.language);
      console.log('平台:', navigator.platform);
      console.log('UserAgent:', navigator.userAgent);
      console.log('屏幕:', `${screen.width}x${screen.height}`);
      console.log('视口:', `${window.innerWidth}x${window.innerHeight}`);
      console.log('Cookie:', navigator.cookieEnabled ? '启用' : '禁用');
      console.log('ServiceWorker:', 'serviceWorker' in navigator ? '支持' : '不支持');
      console.log('NODE_ENV:', typeof process !== 'undefined' ? process.env.NODE_ENV : 'N/A');
      console.groupEnd();
    } else {
      // 生产环境：关键排错信息（折叠分组，不占空间）
      console.groupCollapsed('%c[ENV] 运行环境', 'color: #6b7280; font-size: 11px');
      console.log('Release:', release);
      console.log('主机:', window.location.hostname);
      console.log('协议:', window.location.protocol);
      console.log('平台:', navigator.platform);
      console.log('语言:', navigator.language);
      console.log('Cookie:', navigator.cookieEnabled ? '启用' : '禁用');
      console.log('ServiceWorker:', 'serviceWorker' in navigator ? '支持' : '不支持');
      console.log('视口:', `${window.innerWidth}x${window.innerHeight}`);
      console.groupEnd();
    }
  }
}

export default Logger;
