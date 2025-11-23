/**
 * Netlify Function: Giffgaff GraphQL API
 * 处理GraphQL请求,解决CORS问题
 */

const axios = require('axios');
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');

// 输入验证schema
const graphqlSchema = {
  query: {
    required: true,
    type: 'string',
    minLength: 10
  },
  accessToken: {
    required: false,
    type: 'string',
    minLength: 50
  }
};

exports.handler = withAuth(async (event, context, { auth, body }) => {
  // 解析请求体
  const { mfaSignature, mfaRef, query, variables, operationName, cookie } = body;

  // 从请求体或 Authorization 头提取 accessToken（兼容两种方式）
  const lowerCaseHeaders = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
  );
  const authHeader = lowerCaseHeaders['authorization'] || '';
  let accessToken = body.accessToken;
  if (!accessToken && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7);
  }

  if (!accessToken) {
    throw new AuthError('accessToken是必需的', 400);
  }

  if (!query) {
    throw new AuthError('GraphQL query是必需的', 400);
  }

  // 构建请求头（使用真实的 iOS App UA 和头部）
  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'Accept': '*/*',
    'User-Agent': process.env.GG_USER_AGENT || 'giffgaff/1332 CFNetwork/1568.300.101 Darwin/24.2.0',
    'Origin': 'https://publicapi.giffgaff.com',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
  };

  // 针对 reserveESim / swapSim / eSimDownloadToken 需要设备元数据头
  const opName = operationName || '';
  const isReserve = /reserveESim\s*\(/.test(String(query || '')) || /reserveESim/i.test(opName);
  const isSwap = /swapSim\s*\(/i.test(String(query || '')) || /swapSim/i.test(opName);
  const isToken = /eSimDownloadToken\s*\(/i.test(String(query || '')) || /eSimDownloadToken/i.test(opName);
  const isMfaChallenge = /simSwapMfaChallenge/i.test(String(query || '')) || /simSwapMfaChallenge/i.test(opName);
  const needsAppHeaders = isReserve || isSwap || isToken || isMfaChallenge;

  if (needsAppHeaders) {
    requestHeaders['x-gg-app-device-manufacturer'] = process.env.GG_APP_DEVICE_MANUFACTURER || 'Apple';
    requestHeaders['x-gg-app-os'] = process.env.GG_APP_OS || 'iOS';
    requestHeaders['x-gg-app-version'] = process.env.GG_APP_VERSION || '17.46.11';
    requestHeaders['x-gg-app-build-number'] = process.env.GG_APP_BUILD_NUMBER || '1332';
    requestHeaders['x-gg-app-os-version'] = process.env.GG_APP_OS_VERSION || '18.2';
    requestHeaders['apollographql-client-name'] = process.env.APOLLO_CLIENT_NAME || 'iOS 18.2';
    requestHeaders['apollographql-client-version'] = process.env.APOLLO_CLIENT_VERSION || '17.46.11 1332';
    requestHeaders['x-gg-app-bundle-version'] = process.env.GG_APP_BUNDLE_VERSION || 'v0';
    requestHeaders['x-gg-app-device-model'] = process.env.GG_APP_DEVICE_MODEL || 'iPhone SE';
    requestHeaders['x-gg-app-device-id'] = process.env.GG_APP_DEVICE_ID || 'iPhone12,8';
    requestHeaders['baggage'] = process.env.GG_BAGGAGE || 'client-tracking-ctx-id=d1c9ee72-573b-490e-a219-6b41992a5bdb';

    try {
      const { randomUUID } = require('crypto');
      requestHeaders['x-request-id'] = randomUUID();
    } catch (_) {}
  }

  // 如果有MFA签名，添加到请求头
  if (mfaSignature) {
    requestHeaders['X-MFA-Signature'] = mfaSignature;
    requestHeaders['x-mfa-signature'] = mfaSignature;
  }

  // 构建GraphQL请求体
  const graphqlBody = {
    query,
    variables: variables || {},
    operationName: operationName || null
  };

  // 供失败时刷新令牌使用的 verify-cookie 地址
  const hostHdr = lowerCaseHeaders['x-forwarded-host'] || lowerCaseHeaders['host'] || '';
  const protoHdr = lowerCaseHeaders['x-forwarded-proto'] || 'https';
  const verifyCookieUrl = hostHdr ? `${protoHdr}://${hostHdr}/.netlify/functions/verify-cookie` : ((process.env.URL || '').replace(/\/$/, '') + '/.netlify/functions/verify-cookie');

  // 调用Giffgaff GraphQL API
  let response;
  try {
    response = await axios.post(
      'https://publicapi.giffgaff.com/gateway/graphql',
      graphqlBody,
      { headers: requestHeaders, timeout: 30000 }
    );
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data || {};
    const isUnauthorized = status === 401 || data?.error === 'unauthorized' || /invalid_token/i.test(String(data?.error || ''));

    // 失败 401 时尝试用 cookie 刷新后重试一次
    if (isUnauthorized && cookie) {
      try {
        const r = await axios.post(verifyCookieUrl, { cookie }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        });

        if (r.data?.success && r.data?.accessToken) {
          accessToken = r.data.accessToken;
          requestHeaders['Authorization'] = `Bearer ${accessToken}`;
          response = await axios.post(
            'https://publicapi.giffgaff.com/gateway/graphql',
            graphqlBody,
            { headers: requestHeaders, timeout: 30000 }
          );
        } else {
          throw err;
        }
      } catch (reErr) {
        throw new AuthError('Access token expired. Please re-login with cookie.', 401);
      }
    } else {
      throw err;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(response.data)
  };
}, { validateSchema: graphqlSchema });
