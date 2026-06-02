/**
 * Netlify Function: Giffgaff GraphQL API
 * 处理GraphQL请求,解决CORS问题
 */

const axios = require('axios');
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');
const { getInternalHeaders } = require('./_shared/internal-headers');

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
  const ts = new Date().toISOString();
  console.log(`[GGQL] ${ts} | invoked, operationName=${body.operationName || 'none'}, hasAccessToken=${!!body.accessToken}, hasMfaSignature=${!!body.mfaSignature}, hasCookie=${!!body.cookie}`);

  // 解析请求体
  const { mfaSignature, mfaRef, query, variables, operationName, cookie } = body;

  // 从请求体或 Authorization 头提取 accessToken（兼容两种方式）
  const lowerCaseHeaders = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
  );
  const authHeader = lowerCaseHeaders['authorization'] || '';
  const headerMfaRefRaw = lowerCaseHeaders['x-mfa-ref'] || lowerCaseHeaders['x-mfa-challenge-ref'] || '';
  const headerMfaRef = typeof headerMfaRefRaw === 'string' ? headerMfaRefRaw.trim() : '';
  const bodyMfaRef = typeof mfaRef === 'string' ? mfaRef.trim() : '';
  const resolvedMfaRef = bodyMfaRef || headerMfaRef;
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
  const isESims = /eSims\s*\(/i.test(String(query || '')) || /getESims/i.test(opName);
  const needsAppHeaders = isReserve || isSwap || isToken || isMfaChallenge || isESims;

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

  if (isSwap && resolvedMfaRef) {
    // 上游 swapSim 对 MFA challenge ref 兼容性要求较严格，显式双写头部
    requestHeaders['X-GG-MFA-REF'] = resolvedMfaRef;
    requestHeaders['x-gg-mfa-ref'] = resolvedMfaRef;
  }

  // 构建GraphQL请求体
  const graphqlBody = {
    query,
    variables: variables || {},
    operationName: operationName || null
  };

  // swapSim 需要 mfaRef 作为顶层字段（Giffgaff schema 要求）
  if (resolvedMfaRef) {
    graphqlBody.mfaRef = resolvedMfaRef;
  }

  if (isSwap && !resolvedMfaRef) {
    throw new AuthError('swapSim 缺少 mfaRef（MFA challenge reference）', 400);
  }

  if (isSwap) {
    graphqlBody.variables = {
      ...(graphqlBody.variables || {}),
      mfaRef: resolvedMfaRef
    };
  }

  // 供失败时刷新令牌使用的 verify-cookie 地址
  const hostHdr = lowerCaseHeaders['x-forwarded-host'] || lowerCaseHeaders['host'] || '';
  const protoHdr = lowerCaseHeaders['x-forwarded-proto'] || 'https';
  const verifyCookieUrl = hostHdr ? `${protoHdr}://${hostHdr}/.netlify/functions/verify-cookie` : ((process.env.URL || '').replace(/\/$/, '') + '/.netlify/functions/verify-cookie');

  // 调用Giffgaff GraphQL API
  console.log(`[GGQL] ${ts} | calling upstream: op=${opName}, isSwap=${isSwap}, hasMfaSignature=${!!mfaSignature}, hasResolvedMfaRef=${!!resolvedMfaRef}`);

  // swapSim 操作在遇到上游 500 错误时自动重试（最多 2 次）
  const maxRetries = isSwap ? 2 : 0;
  let response;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delayMs = attempt * 1500;
      console.log(`[GGQL] ${ts} | retry #${attempt} for ${opName} after ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
    }

    try {
      response = await axios.post(
        'https://publicapi.giffgaff.com/gateway/graphql',
        graphqlBody,
        { headers: requestHeaders, timeout: 30000 }
      );
      console.log(`[GGQL] ${ts} | upstream OK: status=${response.status}, hasData=${!!response.data}, hasErrors=${!!response.data?.errors}`);

      // Giffgaff 返回 HTTP 200 但 GraphQL body 包含 errors 时，视为业务失败
      if (response.data?.errors?.length > 0) {
        const gqlErr = response.data.errors[0];
        const gqlMsg = gqlErr?.message || gqlErr?.error || JSON.stringify(gqlErr);
        console.error(`[GGQL] ${ts} | GraphQL errors from upstream: ${gqlMsg}`);

        // 区分上游服务器错误（500）和业务校验错误
        const isUpstream500 = /500|internal.?server.?error/i.test(gqlMsg);
        if (isUpstream500 && attempt < maxRetries) {
          console.warn(`[GGQL] ${ts} | upstream 500 on attempt #${attempt}, will retry`);
          continue; // 重试
        }

        const errorType = isUpstream500 ? '上游服务器错误' : '业务校验错误';
        throw new AuthError(`Upstream GraphQL ${errorType}: ${gqlMsg}`, isUpstream500 ? 502 : 422);
      }

      // 成功，跳出重试循环
      break;
    } catch (err) {
      // AuthError（含上游 500）已在上方抛出，直接向上传播
      if (err instanceof AuthError) throw err;

      const status = err.response?.status;
      const data = err.response?.data || {};
      const isUnauthorized = status === 401 || data?.error === 'unauthorized' || /invalid_token/i.test(String(data?.error || ''));
      console.error(`[GGQL] ${ts} | upstream FAILED: status=${status}, isUnauthorized=${isUnauthorized}, errMsg=${err.message}`);

      // 失败 401 时尝试用 cookie 刷新后重试一次
      if (isUnauthorized && cookie) {
        console.log(`[GGQL] ${ts} | attempting cookie-based token refresh`);
        try {
          const r = await axios.post(verifyCookieUrl, { cookie }, {
            headers: getInternalHeaders(),
            timeout: 15000
          });

          if (r.data?.valid && r.data?.accessToken) {
            accessToken = r.data.accessToken;
            requestHeaders['Authorization'] = `Bearer ${accessToken}`;
            console.log(`[GGQL] ${ts} | token refreshed, retrying upstream call`);
            response = await axios.post(
              'https://publicapi.giffgaff.com/gateway/graphql',
              graphqlBody,
              { headers: requestHeaders, timeout: 30000 }
            );
            console.log(`[GGQL] ${ts} | retry OK: status=${response.status}`);
            break; // 重试成功，跳出循环
          } else {
            console.error(`[GGQL] ${ts} | cookie refresh failed: valid=${r.data?.valid}`);
            throw err;
          }
        } catch (reErr) {
          console.error(`[GGQL] ${ts} | token refresh/retry FAILED: ${reErr.message}`);
          throw new AuthError('Access token expired. Please re-login with cookie.', 401);
        }
      } else {
        throw err;
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(response.data)
  };
}, { validateSchema: graphqlSchema });
