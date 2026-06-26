/**
 * Netlify Function: Giffgaff MFA Validation
 * 处理MFA邮件验证码验证请求
 */

const axios = require('axios');
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');
const { getInternalHeaders } = require('./_shared/internal-headers');

// 输入验证schema
const mfaValidationSchema = {
  ref: {
    required: true,
    type: 'string',
    minLength: 10
  },
  code: {
    required: true,
    type: 'string',
    minLength: 4,
    maxLength: 10
  }
};

exports.handler = withAuth(async (event, ctx, { auth, body }) => {
  const logger = ctx.logger;

  logger.info('invoked', {
    hasRef: !!body.ref,
    hasCode: !!body.code,
    hasCookie: !!body.cookie,
  });

  // 输入验证
  validateInput(mfaValidationSchema, body);

  const { ref, code, cookie } = body;

  // 从请求体或 Authorization 头提取 accessToken（兼容两种方式）
  const lowerCaseHeaders = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
  );
  const authHeader = lowerCaseHeaders['authorization'] || '';
  let accessToken = body.accessToken;
  if (!accessToken && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7);
  }

  if (!accessToken && !cookie) {
    throw new AuthError('accessToken 或 cookie 至少提供一个', 400);
  }

  // 站点URL用于内部调用 verify-cookie
  const hostHeader = lowerCaseHeaders['x-forwarded-host'] || lowerCaseHeaders['host'] || '';
  const protoHeader = lowerCaseHeaders['x-forwarded-proto'] || 'https';
  const verifyCookieUrl = hostHeader ? `${protoHeader}://${hostHeader}/.netlify/functions/verify-cookie` : ((process.env.URL || '').replace(/\/$/, '') + '/.netlify/functions/verify-cookie');

  // 如果提供cookie但没有accessToken,先尝试使用cookie获取accessToken
  if (cookie && !accessToken) {
    try {
      const cookieVerifyResponse = await axios.post(verifyCookieUrl, { cookie }, {
        headers: getInternalHeaders(),
        timeout: 30000
      });

      if (cookieVerifyResponse.data?.valid && cookieVerifyResponse.data?.accessToken) {
        accessToken = cookieVerifyResponse.data.accessToken;
      }
    } catch (cookieError) {
      // Cookie验证失败不影响主流程
    }
  }

  // 调用Giffgaff MFA验证API
  const sendValidation = async (token) => axios.post(
    'https://id.giffgaff.com/v4/mfa/validation',
    { ref, code },
    {
      headers: (() => {
        const h = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': process.env.GG_USER_AGENT || 'giffgaff/1332 CFNetwork/1568.300.101 Darwin/24.2.0',
          'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        };
        if (token) h['Authorization'] = `Bearer ${token}`;
        if (!token && cookie) h['Cookie'] = cookie;
        return h;
      })(),
      timeout: 30000
    }
  );

  let response;
  try {
    response = await sendValidation(accessToken);
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data || {};

    // 401: token 过期，尝试用 cookie 刷新
    const isExpired = status === 401 && (data.error === 'invalid_token' || /expired/i.test(String(data.error_description || '')));

    if (isExpired && cookie) {
      try {
        const cookieVerifyResponse = await axios.post(verifyCookieUrl, { cookie }, {
          headers: getInternalHeaders(),
          timeout: 30000
        });

        if (cookieVerifyResponse.data?.valid && cookieVerifyResponse.data?.accessToken) {
          const refreshed = cookieVerifyResponse.data.accessToken;
          response = await sendValidation(refreshed);
        } else {
          throw err;
        }
      } catch (reErr) {
        throw new AuthError('Access token expired. Please re-login with cookie.', 401);
      }
    } else if (status === 400) {
      // 400 分类：区分 ref 过期 vs 验证码错误，便于前端重试策略
      // 读取多个可能的错误字段，避免遗漏上游错误信息
      const rawError = String(
        data.error || data.message || data.error_description || JSON.stringify(data) || err.message
      );
      const isRefExpired = /expired|invalid.*ref|ref.*invalid|not.?found/i.test(rawError);
      const statusCode = isRefExpired ? 410 : 400;
      const message = isRefExpired
        ? 'Verification reference expired or invalid. Please request a new code.'
        : `Validation failed: ${rawError}`;
      throw new AuthError(message, statusCode);
    } else {
      throw err;
    }
  }

  logger.info('validation_ok', {
    hasSignature: !!response?.data?.signature,
  });

  return {
    statusCode: 200,
    body: JSON.stringify(response.data)
  };
}, { validateSchema: mfaValidationSchema });
