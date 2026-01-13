'use strict';

/**
 * 通知消息API
 * 提供系统通知消息的查询接口
 */

const { withAuth } = require('./_shared/middleware');

// 通知消息数据（可以从JSON文件或数据库读取）
const NOTIFICATIONS = [
  {
    id: 'fix-simyo-api',
    message: '已更新Simyo端点,完善更换流程',
    type: 'success',
    timestamp: '2026-01-13T00:30:00Z',
    active: true,
    priority: 1
  },
  {
    id: 'fix-400-error',
    message: '已修复Oauth交换时报错400问题,优化了MFA验证流程',
    type: 'success',
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
exports.handler = withAuth(async (event, context, { auth }) => {
  const { httpMethod, queryStringParameters } = event;

  // 仅支持GET请求
  if (httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

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
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    })
  };
}, { requireAuth: false }); // 公开接口，不需要认证
