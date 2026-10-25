/**
 * eSIM Tools 统计服务
 * 使用 Upstash Redis HTTP REST 存储与统计 eSIM 成功获取次数
 */

const { parseOrigins, isAllowedOrigin, resolveCorsOrigin } = require('./_shared/cors');
const { isRateLimited } = require('./_shared/rate-limiter');

const origins = parseOrigins(process.env.ALLOWED_ORIGIN);

const KEY_GIFFGAFF = 'stats:esim:giffgaff';
const KEY_SIMYO = 'stats:esim:simyo';
const UPSTASH_TIMEOUT_MS = 5000;

/**
 * 执行 Upstash Redis REST 命令（带超时控制）
 * @param {string} url - Upstash REST URL
 * @param {string} token - Upstash REST Token
 * @param {Array<string|number>} command - Redis 命令数组
 * @returns {Promise<any>}
 */
async function executeUpstashCommand(url, token, command) {
  const cleanUrl = url.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTASH_TIMEOUT_MS);

  try {
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Upstash API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Upstash Redis error: ${data.error}`);
    }

    return data.result;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 提取客户端标识（优先使用安全代理头）
 */
function getClientIp(event) {
  const headers = event.headers || {};
  return headers['x-nf-client-connection-ip'] ||
    headers['cf-connecting-ip'] ||
    headers['client-ip'] ||
    headers['x-real-ip'] ||
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown';
}

/**
 * 安全解析整数
 */
function parseCount(val) {
  const n = parseInt(val, 10);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

/**
 * Netlify Function 入口
 */
const handler = async (event) => {
  const headers = event.headers || {};
  const requestOrigin = headers.origin || headers.Origin || null;

  // 1. Origin 安全校验：如果携带了 Origin 且不受信任，直接拦截
  if (requestOrigin && !isAllowedOrigin(requestOrigin, origins)) {
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json',
        'Vary': 'Origin'
      },
      body: JSON.stringify({ error: 'Forbidden', message: 'Origin not allowed' })
    };
  }

  const allowOrigin = resolveCorsOrigin(requestOrigin, origins);
  const defaultHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-esim-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };

  // 2. 处理 OPTIONS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: defaultHeaders,
      body: ''
    };
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const isConfigured = Boolean(redisUrl && redisToken);

  // 3. 处理 GET：获取统计数据
  if (event.httpMethod === 'GET') {
    if (!isConfigured) {
      return {
        statusCode: 200,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, s-maxage=60'
        },
        body: JSON.stringify({
          success: true,
          configured: false,
          giffgaff: 0,
          simyo: 0,
          total: 0
        })
      };
    }

    try {
      const result = await executeUpstashCommand(redisUrl, redisToken, [
        'MGET',
        KEY_GIFFGAFF,
        KEY_SIMYO
      ]);

      if (!Array.isArray(result)) {
        throw new Error('Unexpected MGET response format');
      }

      const giffgaffCount = parseCount(result[0]);
      const simyoCount = parseCount(result[1]);
      const totalCount = giffgaffCount + simyoCount;

      return {
        statusCode: 200,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, s-maxage=60'
        },
        body: JSON.stringify({
          success: true,
          configured: true,
          giffgaff: giffgaffCount,
          simyo: simyoCount,
          total: totalCount
        })
      };
    } catch (error) {
      console.error('[stats] Failed to fetch stats from Upstash:', error.message);
      return {
        statusCode: 200,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          success: false,
          configured: isConfigured,
          error: 'Failed to retrieve stats',
          giffgaff: 0,
          simyo: 0,
          total: 0
        })
      };
    }
  }

  // 4. 处理 POST：成功获取后递增计数
  if (event.httpMethod === 'POST') {
    // 4.1 严格校验 JSON 格式及类型（先校验 Payload，防止无效请求耗尽限流配额）
    let body;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return {
        statusCode: 400,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return {
        statusCode: 400,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Request body must be a JSON object' })
      };
    }

    const { type } = body;
    if (type !== 'giffgaff' && type !== 'simyo') {
      return {
        statusCode: 400,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Invalid type parameter. Expected "giffgaff" or "simyo"' })
      };
    }

    // 4.2 服务端限流检查（每分钟单 IP 上限 30 次，支持代理与移动网络出口）
    const clientIp = getClientIp(event);
    const rateLimited = await isRateLimited(`stats:${clientIp}`, 60000, 30);
    if (rateLimited) {
      return {
        statusCode: 429,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '60'
        },
        body: JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded' })
      };
    }

    if (!isConfigured) {
      return {
        statusCode: 200,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          configured: false,
          type,
          count: 0
        })
      };
    }

    const targetKey = type === 'giffgaff' ? KEY_GIFFGAFF : KEY_SIMYO;

    try {
      const newCount = await executeUpstashCommand(redisUrl, redisToken, ['INCR', targetKey]);
      const validCount = parseCount(newCount);

      if (validCount <= 0 && newCount !== 0) {
        throw new Error(`Invalid INCR return value: ${newCount}`);
      }

      return {
        statusCode: 200,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          configured: true,
          type,
          count: validCount
        })
      };
    } catch (error) {
      console.error(`[stats] Failed to increment ${type} in Upstash:`, error.message);
      return {
        statusCode: 500,
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          configured: isConfigured,
          error: 'Failed to increment counter'
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers: {
      ...defaultHeaders,
      'Allow': 'GET, POST, OPTIONS',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ error: 'Method Not Allowed' })
  };
};

module.exports = {
  handler,
  KEY_GIFFGAFF,
  KEY_SIMYO,
  UPSTASH_TIMEOUT_MS,
  executeUpstashCommand,
  parseCount
};
