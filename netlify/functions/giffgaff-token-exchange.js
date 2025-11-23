/**
 * Netlify Function: Giffgaff OAuth Token Exchange
 * 将前端回调得到的 authorization code 与 code_verifier 交换为 access_token
 * 机密信息只存在于服务端环境变量中，避免前端泄露
 */

const axios = require('axios');

exports.handler = async (event) => {
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://esim.cosr.eu.org';
  const lower = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v]));
  const requestOrigin = lower['origin'];
  const ACCESS_KEY = process.env.ACCESS_KEY || process.env.ESIM_ACCESS_KEY;
  const getProvidedKey = () => {
    const fromHeader = lower['x-esim-key'] || lower['x-app-key'] || '';
    if (fromHeader) return fromHeader;
    try {
      const bodyObj = JSON.parse(event.body || '{}');
      if (bodyObj && typeof bodyObj.authKey === 'string') return bodyObj.authKey;
    } catch {}
    const q = event.queryStringParameters || {};
    if (q.authKey) return q.authKey;
    return '';
  };

  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden', message: 'Origin not allowed' }) };
    }
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed', message: '只允许POST请求' })
    };
  }

  if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden', message: 'Origin not allowed' }) };
  }

  if (!ACCESS_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server Misconfigured', message: 'ACCESS_KEY not configured' }) };
  }
  const provided = getProvidedKey();
  if (!provided || provided !== ACCESS_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized', message: 'Missing or invalid auth key' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { code, code_verifier: codeVerifier, redirect_uri: redirectUri } = body;

    if (!code || !codeVerifier) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Bad Request', message: 'code 与 code_verifier 均为必需参数' })
      };
    }

    const clientId = process.env.GIFFGAFF_CLIENT_ID;
    const clientSecret = process.env.GIFFGAFF_CLIENT_SECRET;
    // 根据Postman配置文件中的设置使用正确的令牌端点URL
    const tokenUrl = process.env.GIFFGAFF_TOKEN_URL || 'https://id.giffgaff.com/auth/oauth/token';
    const defaultRedirectUri = process.env.GIFFGAFF_REDIRECT_URI || 'giffgaff://auth/callback/';

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Server Misconfiguration',
          message: '缺少 GIFFGAFF_CLIENT_ID 或 GIFFGAFF_CLIENT_SECRET 环境变量'
        })
      };
    }

    // 使用正确的客户端密钥格式，确保包含等号
    let cleanedSecret = clientSecret;
    
    // 确保客户端密钥包含等号，这在base64密钥中很重要
    if (!cleanedSecret.endsWith('=')) {
      // 如果不是以等号结尾，先检查是否以百分号结尾并去除
      if (cleanedSecret.endsWith('%')) {
        cleanedSecret = cleanedSecret.slice(0, -1);
        console.log('检测到客户端密钥末尾有百分号，已去除');
      }
      
      // 如果客户端密钥是标准的base64，但缺少等号，添加等号
      if (!/=$/.test(cleanedSecret)) {
        cleanedSecret = cleanedSecret + '=';
        console.log('客户端密钥可能缺少等号，已添加');
      }
    }
    
    console.log(`使用客户端ID: ${clientId.substring(0, 5)}*****`);
    console.log(`客户端密钥长度: ${cleanedSecret.length}`);
    const authHeader = Buffer.from(`${clientId}:${cleanedSecret}`).toString('base64');

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || defaultRedirectUri,
      code_verifier: codeVerifier
    });

    // 添加调试日志
console.log(`请求令牌端点: ${tokenUrl}`);
console.log(`请求参数: ${form.toString()}`);
// 不打印敏感信息
console.log(`请求头部: Authorization: Basic ******, Content-Type: application/x-www-form-urlencoded`);

// 根据Postman配置使用Authorization头发送客户端凭据，而不是表单参数
const formWithCredentials = new URLSearchParams({
  grant_type: 'authorization_code',
  code,
  redirect_uri: redirectUri || defaultRedirectUri,
  code_verifier: codeVerifier
});

console.log(`请求参数(包含凭据): ${formWithCredentials.toString().replace(cleanedSecret, '******')}`);

// 确保授权码没有被额外编码
// 如果授权码中包含了URL编码字符，尝试解码一次
let decodedCode = code;
try {
  if (code.includes('%')) {
    const possiblyDecodedCode = decodeURIComponent(code);
    if (possiblyDecodedCode !== code) {
      decodedCode = possiblyDecodedCode;
      console.log('检测到授权码可能被多次编码，已解码');
      
      // 更新表单参数
      formWithCredentials.set('code', decodedCode);
    }
  }
} catch (e) {
  console.log('授权码解码失败，使用原始码');
}

const response = await axios.post(tokenUrl, formWithCredentials, {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'Authorization': `Basic ${authHeader}`
  },
  timeout: 30000
});

    return { statusCode: 200, headers, body: JSON.stringify(response.data) };
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || { message: error.message };
    
    // 添加详细错误日志
    console.error('Token exchange error:', {
      status,
      data,
      message: error.message,
      stack: error.stack
    });
    
    return {
      statusCode: status,
      headers,
      body: JSON.stringify({ error: 'Token Exchange Failed', details: data })
    };
  }
};
