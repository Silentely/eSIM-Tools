/**
 * 构建脚本日志工具
 * 为构建/部署脚本提供统一的日志输出
 * 注: 构建脚本始终需要输出信息,因此不像前端Logger那样禁用
 */

// ANSI颜色码
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

class BuildLogger {
  /**
   * 信息日志 (蓝色)
   */
  static log(...args) {
    console.log(colors.blue + '[INFO]' + colors.reset, ...args);
  }

  /**
   * 成功日志 (绿色)
   */
  static success(...args) {
    console.log(colors.green + '[SUCCESS]' + colors.reset, ...args);
  }

  /**
   * 警告日志 (黄色)
   */
  static warn(...args) {
    console.warn(colors.yellow + '[WARN]' + colors.reset, ...args);
  }

  /**
   * 错误日志 (红色)
   */
  static error(...args) {
    console.error(colors.red + '[ERROR]' + colors.reset, ...args);
  }

  /**
   * 调试日志 (灰色)
   */
  static debug(...args) {
    if (process.env.DEBUG || process.env.VERBOSE) {
      console.log(colors.gray + '[DEBUG]' + colors.reset, ...args);
    }
  }

  /**
   * 标题日志 (粗体青色)
   */
  static title(text) {
    console.log('\n' + colors.bold + colors.cyan + text + colors.reset);
    console.log(colors.cyan + '='.repeat(text.length) + colors.reset);
  }

  /**
   * 进度信息 (无标签)
   */
  static progress(...args) {
    console.log('  ', ...args);
  }

  /**
   * 检查项 (带emoji)
   */
  static check(passed, message) {
    const icon = passed ? '✅' : '❌';
    const color = passed ? colors.green : colors.red;
    console.log(icon, color + message + colors.reset);
  }

  /**
   * 步骤开始
   */
  static step(number, total, message) {
    console.log(colors.cyan + `\n[${number}/${total}]` + colors.reset, colors.bold + message + colors.reset);
  }
}

module.exports = BuildLogger;
