'use strict';

/**
 * 内部通知API
 * 供前端页面直接调用，无需认证
 */

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://esim.cosr.eu.org';

// 通知消息数据（可以从JSON文件或数据库读取）
const NOTIFICATIONS = [
  {
    id: 'fix-giffgaff-oauth',
    message: 'giffgaff的oauth登录方式已变更,请阅读新方法使用',
    type: 'info',
    timestamp: '2026-01-22T13:50:00Z',
    active: true,
    priority: 1
  },
  {
    id: 'fix-400-error',
    message: '已修复Oauth交换时报错400问题,优化了MFA验证流程',
    type: 'info',
    timestamp: '2025-11-30T10:00:00Z',
    active: false,
    priority: 1
  },
  {
    id: 'new-feature-oauth',
    message: '新功能:支持OAuth 2.0 PKCE认证流程',
    type: 'info',
    timestamp: '2025-06-20T15:30:00Z',
    active: false,
    priority: 2
  }
];

/**
 * 生成CORS响应头
 */
function createHeaders(additionalHeaders = {}) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
    ...additionalHeaders
  };
}

/**
 * 获取活跃通知
 */
function getActiveNotifications() {
  return NOTIFICATIONS
    .filter(n => n.active)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * 获取最新通知
 */
function getLatestNotification() {
  const active = getActiveNotifications();
  return active.length > 0 ? active[0] : null;
}

/**
 * 主处理函数
 */
exports.handler = async (event) => {
  const { httpMethod, queryStringParameters } = event;

  // 处理CORS预检
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: createHeaders()
    };
  }

  // 仅支持GET请求
  if (httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: createHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const mode = queryStringParameters?.mode || 'all';

    let data;
    switch (mode) {
      case 'latest':
        data = getLatestNotification();
        break;
      case 'all':
      default:
        data = getActiveNotifications();
        break;
    }

    return {
      statusCode: 200,
      headers: createHeaders(),
      body: JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('[notifications-internal] Error:', error.message);
    return {
      statusCode: 500,
      headers: createHeaders(),
      body: JSON.stringify({
        error: 'InternalServerError',
        message: error.message
      })
    };
  }
};