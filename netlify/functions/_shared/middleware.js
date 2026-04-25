/**
 * Netlify Functions 统一中间件
 * 提供鉴权、CORS、错误处理等功能
 */

const { captureException, flush, setContext } = require('./sentry');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://esim.cosr.eu.org';
const ACCESS_KEY = process.env.ACCESS_KEY;

// 启动时检查密钥
if (!ACCESS_KEY) {
  console.error('❌ 严重错误: ACCESS_KEY 未配置');
  console.error('💡 请在 Netlify 环境变量或 .env 文件中设置');
}

if (ACCESS_KEY === 'please_change_me') {
  console.error('❌ 安全警告: ACCESS_KEY 使用了默认值，请立即修改');
}

/**
 * 自定义错误类
 */
class AuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * 提取请求中提供的认证密钥
 * @param {Object} event - Netlify event 对象
 * @returns {string} 认证密钥
 */
function getProvidedKey(event) {
  const lower = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );

  // 优先级: Header > Body > Query
  const fromHeader = lower['x-esim-key'] || lower['x-app-key'];
  if (fromHeader) return fromHeader;

  try {
    const body = JSON.parse(event.body || '{}');
    if (body && typeof body.authKey === 'string') {
      return body.authKey;
    }
  } catch {}

  const query = event.queryStringParameters || {};
  if (query.authKey) return query.authKey;

  return '';
}

/**
 * 验证请求鉴权
 * @param {Object} event - Netlify event 对象
 * @returns {Object} 鉴权结果 { authorized: boolean, origin: string, preflight: boolean }
 * @throws {AuthError} 鉴权失败时抛出
 */
function authenticate(event) {
  const lower = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const requestOrigin = lower.origin;

  // CORS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    // 验证来源
    if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
      throw new AuthError('Origin not allowed', 403);
    }
    return { preflight: true, origin: requestOrigin };
  }

  // 非预检请求：验证来源
  if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
    throw new AuthError('Origin not allowed', 403);
  }

  // 验证 ACCESS_KEY 是否已配置
  if (!ACCESS_KEY) {
    throw new AuthError('Server Misconfigured: ACCESS_KEY not configured', 500);
  }

  // 提取并验证密钥
  const providedKey = getProvidedKey(event);
  if (!providedKey || providedKey !== ACCESS_KEY) {
    throw new AuthError('Unauthorized: Missing or invalid auth key', 401);
  }

  return { authorized: true, origin: requestOrigin };
}

/**
 * 生成标准响应头
 * @param {string} origin - 请求来源
 * @param {Object} additionalHeaders - 额外的响应头
 * @returns {Object} 响应头对象
 */
function createHeaders(origin = ALLOWED_ORIGIN, additionalHeaders = {}) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MFA-Signature, X-Esim-Key, X-App-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...additionalHeaders
  };
}

/**
 * 统一错误处理
 * @param {Error} error - 错误对象
 * @param {string} context - 错误上下文
 * @returns {Object} Netlify response 对象
 */
function handleError(error, context = 'unknown') {
  const isDev = process.env.NODE_ENV === 'development';
  const statusCode = error.statusCode || (error.response?.status) || 500;

  // 结构化日志（生产环境应集成专业日志服务）
  const logData = {
    context,
    message: error.message,
    status: statusCode,
    timestamp: new Date().toISOString()
  };

  if (isDev) {
    logData.stack = error.stack;
    logData.data = error.response?.data;
  }

  console.error(`[${context}] Error:`, JSON.stringify(logData));

  // Sentry 错误上报（仅上报 5xx 服务端错误，4xx 客户端错误不上报）
  if (statusCode >= 500) {
    setContext('request', { context, statusCode });
    captureException(error, {
      extra: {
        context,
        statusCode,
        responseData: error.response?.data
      }
    });
  }

  return {
    statusCode,
    headers: createHeaders(),
    body: JSON.stringify({
      error: error.name || 'ServerError',
      message: error.message,
      ...(isDev && { stack: error.stack, context })
    })
  };
}

/**
 * 输入验证中间件
 * @param {Object} schema - 验证规则对象
 * @param {Object} data - 待验证数据
 * @throws {AuthError} 验证失败时抛出
 */
function validateInput(schema, data) {
  const errors = [];

  Object.entries(schema).forEach(([key, rules]) => {
    const value = data[key];

    // required 检查
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required`);
      return;
    }

    // 如果值为空且非必填，跳过后续验证
    if (!rules.required && (value === undefined || value === null)) {
      return;
    }

    // type 检查
    if (rules.type && typeof value !== rules.type) {
      errors.push(`${key} must be of type ${rules.type}`);
    }

    // minLength 检查
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`${key} must be at least ${rules.minLength} characters`);
    }

    // maxLength 检查
    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${key} must not exceed ${rules.maxLength} characters`);
    }

    // pattern 检查
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${key} has invalid format`);
    }

    // enum 检查
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
    }
  });

  if (errors.length > 0) {
    const error = new AuthError(`Validation failed: ${errors.join('; ')}`, 400);
    error.validationErrors = errors;
    throw error;
  }
}

/**
 * 包装 Function Handler，自动处理鉴权和错误
 * @param {Function} handler - 业务逻辑处理函数
 * @param {Object} options - 配置选项
 * @returns {Function} 包装后的 handler
 */
function withAuth(handler, options = {}) {
  return async (event, context) => {
    const functionName = context.functionName || 'unknown';

    try {
      // 鉴权（requireAuth: false 时跳过密钥校验，仅保留 CORS 检查）
      let auth;
      if (options.requireAuth === false) {
        const lower = Object.fromEntries(
          Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
        );
        const requestOrigin = lower.origin;

        // CORS 预检请求
        if (event.httpMethod === 'OPTIONS') {
          if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
            throw new AuthError('Origin not allowed', 403);
          }
          return {
            statusCode: 200,
            headers: createHeaders(requestOrigin),
            body: ''
          };
        }

        // 非预检请求：仅验证来源
        if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
          throw new AuthError('Origin not allowed', 403);
        }

        auth = { authorized: false, origin: requestOrigin, public: true };
      } else {
        auth = authenticate(event);
      }

      // 预检请求直接返回（仅 requireAuth=true 分支到达此处）
      if (auth.preflight) {
        return {
          statusCode: 200,
          headers: createHeaders(auth.origin),
          body: ''
        };
      }

      // 解析请求体
      let parsedBody = {};
      if (event.body) {
        try {
          parsedBody = JSON.parse(event.body);
          // 如果是数组格式，取第一个元素（兼容某些客户端）
          if (Array.isArray(parsedBody)) {
            parsedBody = parsedBody[0] || {};
          }
        } catch (e) {
          throw new AuthError('Invalid JSON body', 400);
        }
      }

      // 输入验证（如果提供了 schema）
      if (options.validateSchema) {
        validateInput(options.validateSchema, parsedBody);
      }

      // 执行业务逻辑
      const result = await handler(event, context, { auth, body: parsedBody });

      // 确保返回正确的响应格式
      if (!result.statusCode) {
        return {
          statusCode: 200,
          headers: createHeaders(auth.origin),
          body: JSON.stringify(result)
        };
      }

      // 合并默认头
      result.headers = createHeaders(auth.origin, result.headers || {});
      return result;

    } catch (error) {
      const response = handleError(error, functionName);
      // Serverless 环境需要显式 flush 确保错误发送到 Sentry
      await flush(2000);
      return response;
    }
  };
}

/**
 * 创建带超时的 fetch 包装器
 * @param {string} url - 请求 URL
 * @param {Object} options - fetch 选项
 * @param {number} timeout - 超时时间(毫秒)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

module.exports = {
  authenticate,
  createHeaders,
  handleError,
  validateInput,
  withAuth,
  fetchWithTimeout,
  AuthError
};
