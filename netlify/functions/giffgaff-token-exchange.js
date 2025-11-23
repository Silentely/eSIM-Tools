/**
 * Netlify Function: Giffgaff OAuth Token Exchange
 * 将前端回调得到的 authorization code 与 code_verifier 交换为 access_token
 * 机密信息只存在于服务端环境变量中，避免前端泄露
 */

const axios = require('axios');
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');

// 验证环境变量配置（严格验证，不自动修复）
function validateClientCredentials() {
  const clientId = process.env.GIFFGAFF_CLIENT_ID;
  const clientSecret = process.env.GIFFGAFF_CLIENT_SECRET;

  if (!clientId) {
    throw new AuthError('GIFFGAFF_CLIENT_ID 未配置', 500);
  }

  if (!clientSecret) {
    throw new AuthError('GIFFGAFF_CLIENT_SECRET 未配置', 500);
  }

  // 严格验证 clientSecret 格式（Base64）
  if (!/^[A-Za-z0-9+/]+=*$/.test(clientSecret)) {
    throw new AuthError('GIFFGAFF_CLIENT_SECRET 格式无效：必须为 Base64 编码', 500);
  }

  if (clientSecret.length < 32) {
    throw new AuthError('GIFFGAFF_CLIENT_SECRET 长度过短：必须至少32字符', 500);
  }

  return { clientId, clientSecret };
}

// 输入验证 schema
const tokenExchangeSchema = {
  code: {
    required: true,
    type: 'string',
    minLength: 10,
    maxLength: 500
  },
  code_verifier: {
    required: true,
    type: 'string',
    minLength: 43,
    maxLength: 128,
    pattern: /^[A-Za-z0-9\-._~]+$/
  },
  redirect_uri: {
    required: false,
    type: 'string',
    maxLength: 500
  }
};

exports.handler = withAuth(async (event, context, { auth, body }) => {
  // 输入验证
  validateInput(tokenExchangeSchema, body);

  const { code, code_verifier: codeVerifier, redirect_uri: redirectUri } = body;

  // 验证环境配置
  const { clientId, clientSecret } = validateClientCredentials();

  const tokenUrl = process.env.GIFFGAFF_TOKEN_URL || 'https://id.giffgaff.com/auth/oauth/token';
  const defaultRedirectUri = process.env.GIFFGAFF_REDIRECT_URI || 'giffgaff://auth/callback/';

  // 构建 Basic Auth header（不再自动修复密钥）
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri || defaultRedirectUri,
    code_verifier: codeVerifier
  });

  // 执行令牌交换（使用 axios，30秒超时）
  const response = await axios.post(tokenUrl, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`,
      'User-Agent': 'giffgaff/1332 CFNetwork/1568.300.101 Darwin/24.2.0'
    },
    timeout: 30000
  });

  return {
    statusCode: 200,
    body: JSON.stringify(response.data)
  };
}, {
  validateSchema: tokenExchangeSchema
});
