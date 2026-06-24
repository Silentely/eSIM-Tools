'use strict';

/**
 * Netlify Function: Health Check
 * 提供分层健康检查端点，用于监控服务状态
 *
 * 公开层（无需认证）：返回基础状态信息
 * 私有层（通过 BFF + ACCESS_KEY 认证）：返回环境变量检查计数（隐藏变量名）
 */

const { withAuth } = require('./_shared/middleware');

// 需要检查的关键环境变量列表（仅内部使用，不对外暴露）
const CRITICAL_ENV_VARS = [
  'ACCESS_KEY',
  'ALLOWED_ORIGIN',
  'GIFFGAFF_CLIENT_ID',
  'GIFFGAFF_CLIENT_SECRET'
];

const OPTIONAL_ENV_VARS = [
  'SENTRY_DSN',
  'CAPTCHA_PROVIDER'
];

/**
 * 检查环境变量配置状态
 * @returns {{ total: number, configured: number, missing: number, optional: { total: number, configured: number } }}
 */
function checkEnvStatus() {
  const criticalMissing = CRITICAL_ENV_VARS.filter(key => !process.env[key]);
  const optionalConfigured = OPTIONAL_ENV_VARS.filter(key => !!process.env[key]);

  return {
    total: CRITICAL_ENV_VARS.length,
    configured: CRITICAL_ENV_VARS.length - criticalMissing.length,
    missing: criticalMissing.length,
    optional: {
      total: OPTIONAL_ENV_VARS.length,
      configured: optionalConfigured.length
    }
  };
}

const handler = async (event, context, { auth }) => {
  // 基础健康信息（公开）
  const envStatus = checkEnvStatus();
  const isHealthy = envStatus.missing === 0;
  const health = {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'eSIM-Tools',
    timestamp: new Date().toISOString()
  };

  // 私有层：通过 BFF 认证后返回详细检查（BFF 已注入 ACCESS_KEY 做认证）
  const isDetailRequest = event.queryStringParameters && event.queryStringParameters.detail === 'true';
  if (isDetailRequest) {
    health.version = process.env.APP_VERSION || '2.0.0';
    health.environment = process.env.NODE_ENV || 'production';
    health.uptime = Math.floor(process.uptime());
    health.checks = {
      env: envStatus
    };
  }

  return {
    statusCode: isHealthy ? 200 : 503,
    body: JSON.stringify(health, null, 2)
  };
};

// 公开端点：无需 ACCESS_KEY，仅做 CORS 校验
exports.handler = withAuth(handler, { requireAuth: false });
