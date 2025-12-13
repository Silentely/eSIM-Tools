/**
 * Sentry 配置文件
 *
 * 此文件用于设置 Sentry 配置变量，在构建时由 inject-sentry-config.js 注入实际值
 * 使用外链脚本而非内联脚本，以符合 CSP 策略
 */

// Sentry 配置 - 构建时会被注入实际值
window.SENTRY_DSN = '';
window.SENTRY_ENVIRONMENT = 'production';
window.SENTRY_RELEASE = 'esim-tools@unknown';
