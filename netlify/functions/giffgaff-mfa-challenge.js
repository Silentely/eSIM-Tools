/**
 * Netlify Function: Giffgaff MFA Challenge
 * 处理MFA邮件验证码发送请求,解决CORS和403问题
 */

const axios = require('axios');
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');

// 输入验证schema
const mfaChallengeSchema = {
  source: {
    required: false,
    type: 'string',
    enum: ['esim', 'web', 'app']
  },
  preferredChannels: {
    required: false,
    type: 'object'
  }
};

exports.handler = withAuth(async (event, context, { auth, body }) => {
  const { source = "esim", preferredChannels = ["EMAIL"], cookie } = body;

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
  let mergedCookie = cookie || '';
  if (cookie) {
    // 预热：访问 dashboard 刷新并合并 Set-Cookie
    try {
      const session = axios.create({ maxRedirects: 5, timeout: 30000, validateStatus: () => true });
      const dashResp = await session.get('https://www.giffgaff.com/dashboard', {
        headers: {
          'Cookie': mergedCookie,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
          'Referer': 'https://www.giffgaff.com/auth/login/challenge?redirect=%2Fdashboard',
          'Upgrade-Insecure-Requests': '1',
          'DNT': '1'
        }
      });
      const setCookies = ([]).concat(dashResp.headers['set-cookie'] || []);
      if (setCookies.length) {
        mergedCookie = mergeSetCookies(mergedCookie, setCookies);
      }
    } catch (e) {
      // 预热失败不影响主流程
    }

    // 若还没有 access token,则尝试一次 verify-cookie
    if (!accessToken) {
      try {
        const cookieVerifyResponse = await axios.post(verifyCookieUrl, { cookie: mergedCookie }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });
        if (cookieVerifyResponse.data?.success && cookieVerifyResponse.data?.accessToken) {
          accessToken = cookieVerifyResponse.data.accessToken;
        }
      } catch (cookieError) {
        // Cookie验证失败不影响主流程
      }
    }
  }

  // 获取 CSRF（可提升 /v4/mfa/challenge/me 的通过率）
  let csrfToken = null;
  if (mergedCookie) {
    try {
      const csrfResp = await axios.get('https://id.giffgaff.com/auth/csrf', {
        headers: {
          'Accept': 'application/json',
          'Cookie': mergedCookie,
          'User-Agent': process.env.GG_USER_AGENT || 'giffgaff/1332 CFNetwork/1568.300.101 Darwin/24.2.0',
          'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 15000
      });
      csrfToken = csrfResp.data?.token || null;
    } catch (e) {
      // CSRF获取失败不影响主流程
    }
  }

  // 从 mergedCookie 中提取 XSRF-TOKEN
  let xxsrf = null;
  if (mergedCookie) {
    const m = String(mergedCookie).match(/XSRF-TOKEN=([^;]+)/);
    if (m) xxsrf = decodeURIComponent(m[1]);
  }

  // Web(Cookie)通道：auth/v3/mfa/challenge
  const sendChallengeV3Cookie = async () => {
    const method = Array.isArray(preferredChannels) && preferredChannels[0] === 'TEXT' ? 'text' : 'email';
    return axios.post(
      'https://id.giffgaff.com/auth/v3/mfa/challenge',
      { method },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
          'Origin': 'https://id.giffgaff.com',
          'Referer': 'https://id.giffgaff.com/auth/login/challenge',
          'Device': 'web',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          ...(xxsrf ? { 'x-xsrf-token': xxsrf } : {}),
          ...(mergedCookie ? { 'Cookie': mergedCookie } : {})
        },
        timeout: 30000
      }
    );
  };

  // App(Token)通道：v4
  const sendChallengeV4Token = async (token) => axios.post(
    'https://id.giffgaff.com/v4/mfa/challenge/me',
    { source, preferredChannels },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': process.env.GG_USER_AGENT || 'giffgaff/1332 CFNetwork/1568.300.101 Darwin/24.2.0',
        'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(mergedCookie ? { 'Cookie': mergedCookie } : {})
      },
      timeout: 30000
    }
  );

  let response;
  try {
    // 优先走 Cookie 的 Web 通道
    if (mergedCookie) {
      try {
        response = await sendChallengeV3Cookie();
      } catch (e) {
        // 回退到 v4 + token
        if (accessToken) response = await sendChallengeV4Token(accessToken);
        else throw e;
      }
    } else {
      response = await sendChallengeV4Token(accessToken);
    }
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data || {};
    const isExpired = status === 401 && (data.error === 'invalid_token' || /expired/i.test(String(data.error_description || '')));

    if (isExpired && mergedCookie) {
      try {
        const cookieVerifyResponse = await axios.post(verifyCookieUrl, { cookie: mergedCookie }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });

        if (cookieVerifyResponse.data?.success && cookieVerifyResponse.data?.accessToken) {
          let refreshed = cookieVerifyResponse.data.accessToken;
          const looksLikeJwt = typeof refreshed === 'string' && refreshed.includes('.') && refreshed.length > 200;

          if (!looksLikeJwt) {
            refreshed = null;
          }

          if (refreshed) response = await sendChallengeV4Token(refreshed);
          else response = await sendChallengeV3Cookie();
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
}, { validateSchema: mfaChallengeSchema });

// 合并原始 Cookie 与 Set-Cookie 数组
function mergeSetCookies(originalCookieHeader, setCookieArray) {
  const jar = new Map();
  // 先装入原始 cookie
  String(originalCookieHeader || '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(kv => {
      const eq = kv.indexOf('=');
      if (eq > 0) {
        const k = kv.slice(0, eq).trim();
        const v = kv.slice(eq + 1).trim();
        if (k) jar.set(k, v);
      }
    });
  // 处理 set-cookie 覆盖
  for (const sc of setCookieArray) {
    const pair = String(sc).split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const k = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      if (k) jar.set(k, v);
    }
  }
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}
