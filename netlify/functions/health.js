/**
 * Netlify Function: Health Check
 * 提供健康检查端点，用于监控服务状态
 */

exports.handler = async (event, context) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'eSIM-Tools',
    version: process.env.APP_VERSION || '2.0.0',
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime(),
    checks: {
      accessKey: !!process.env.ACCESS_KEY,
      giffgaffClientId: !!process.env.GIFFGAFF_CLIENT_ID,
      giffgaffClientSecret: !!process.env.GIFFGAFF_CLIENT_SECRET
    }
  };

  // 检查关键环境变量
  const missingConfigs = [];
  if (!process.env.ACCESS_KEY) {
    missingConfigs.push('ACCESS_KEY');
  }
  if (!process.env.GIFFGAFF_CLIENT_ID) {
    missingConfigs.push('GIFFGAFF_CLIENT_ID');
  }
  if (!process.env.GIFFGAFF_CLIENT_SECRET) {
    missingConfigs.push('GIFFGAFF_CLIENT_SECRET');
  }

  if (missingConfigs.length > 0) {
    health.status = 'degraded';
    health.warnings = missingConfigs.map(key => `${key} not configured`);
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body: JSON.stringify(health, null, 2)
  };
};
