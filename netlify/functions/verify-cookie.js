/**
 * Netlify Function: Cookie验证服务
 * 将Giffgaff Cookie转换为Access Token（尽可能接近真实登录状态）
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');

// 简单��内存限流（每个函数实例内生效）
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5分钟
const RATE_LIMIT_MAX = 15; // 窗口最大次数
const requesterHits = new Map(); // ip -> [timestamps]

function isRateLimited(ip) {
  const now = Date.now();
  const arr = requesterHits.get(ip) || [];
  const recent = arr.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requesterHits.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

// 输入验证schema
const verifyCookieSchema = {
  cookie: {
    required: true,
    type: 'string',
    minLength: 10,
    maxLength: 8192
  }
};

exports.handler = withAuth(async (event, context, { auth, body }) => {
  // 输入验证
  validateInput(verifyCookieSchema, body);

  // 简单限流
  const ip = (event.headers['x-forwarded-for'] || '').split(',')[0] ||
              event.headers['client-ip'] ||
              event.headers['x-real-ip'] ||
              'unknown';

  if (isRateLimited(ip)) {
    throw new AuthError('��求过于频繁，请稍后再试', 429);
  }

  const { cookie } = body;

  // 验证Cookie并获取Access Token
  const result = await validateCookieAndGetToken(cookie);

  if (result.success) {
    const looksLikeJwt = typeof result.accessToken === 'string' &&
                         result.accessToken.includes('.') &&
                         result.accessToken.length > 200;

    // 只有拿到疑似 JWT 的令牌才视为可直接进入第2步
    if (!looksLikeJwt) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          valid: false,
          accessToken: null,
          memberId: result.memberId || null,
          emailSignature: null,
          message: 'Cookie验证通过但未获取可用于API的访问令牌，请使用OAuth或确保包含 id.giffgaff.com 域的完整会话后重试'
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        valid: true,
        accessToken: result.accessToken,
        memberId: result.memberId || null,
        emailSignature: null,
        message: 'Cookie验证成功'
      })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      valid: false,
      accessToken: null,
      emailSignature: null,
      message: result.error || '无法��Cookie获取访问令牌'
    })
  };
}, {
  validateSchema: verifyCookieSchema
});

/**
 * 验证Cookie并尝试获取Access Token
 */
async function validateCookieAndGetToken(cookie) {
  try {
    // 访问主页，尝试从HTML中提取登录状态或令牌
    const response = await axios.get('https://www.giffgaff.com/', {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // 尝试从页面中提取member ID
    const memberId = extractMemberId($, response.data);

    // 尝试从Cookie中提取或通过后续请求获取token
    const accessToken = await extractAccessToken(cookie);

    return {
      success: true,
      valid: !!memberId,
      memberId,
      accessToken
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 从页面中提取Member ID
 */
function extractMemberId($, html) {
  // 尝试多种方法提取member ID
  const metaMemberId = $('meta[name="member-id"]').attr('content');
  if (metaMemberId) return metaMemberId;

  const dataGgMember = $('[data-gg-member]').attr('data-gg-member');
  if (dataGgMember) return dataGgMember;

  const matchMemberId = html.match(/memberId["\s:]+(\d+)/i);
  if (matchMemberId && matchMemberId[1]) return matchMemberId[1];

  return null;
}

/**
 * 尝试提取或获取Access Token
 */
async function extractAccessToken(cookie) {
  try {
    // 尝试访问需要认证的API端点来触发token生成
    const apiResponse = await axios.get('https://www.giffgaff.com/auth/user-status', {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    // 检查响应中是否包含token
    const token = apiResponse.data?.accessToken ||
                  apiResponse.data?.token ||
                  apiResponse.headers['x-access-token'];

    return token || null;
  } catch (error) {
    // 尝试从Set-Cookie中提取
    const setCookie = error.response?.headers['set-cookie'];
    if (setCookie && Array.isArray(setCookie)) {
      const tokenCookie = setCookie.find(c => c.includes('access_token='));
      if (tokenCookie) {
        const match = tokenCookie.match(/access_token=([^;]+)/);
        return match ? match[1] : null;
      }
    }
    return null;
  }
}
