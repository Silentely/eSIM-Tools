/**
 * Netlify Function: Cookie验证服务
 * 将Giffgaff Cookie转换为Access Token（尽可能接近真实登录状态）
 */

const axios = require('axios');
const cheerio = require('cheerio');

// 简单的内存限流（每个函数实例内生效）
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

exports.handler = async (event, context) => {
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

    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
        'Content-Type': 'application/json'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden', message: 'Origin not allowed' }) };
        }
        return { statusCode: 200, headers, body: '' };
    }

    // 限制来源（服务端内部互调通常无 Origin，将被允许）
    if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden', message: 'Origin not allowed' }) };
    }

    if (!ACCESS_KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Server Misconfigured', message: 'ACCESS_KEY not configured' }) };
    }
    const provided = getProvidedKey();
    if (!provided || provided !== ACCESS_KEY) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized', message: 'Missing or invalid auth key' }) };
    }

    // 只允许POST请求
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: 'Method Not Allowed',
                message: '只允许POST请求'
            })
        };
    }

    try {
        // 简单限流
        const ip = (event.headers['x-forwarded-for'] || '').split(',')[0] || event.headers['client-ip'] || event.headers['x-real-ip'] || 'unknown';
        if (isRateLimited(ip)) {
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({ error: 'Too Many Requests', message: '请求过于频繁，请稍后再试' })
            };
        }

        // 解析请求体
        const requestBody = JSON.parse(event.body || '{}');
        const { cookie } = requestBody;

        if (!cookie) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'Cookie参数不能为空'
                })
            };
        }

        console.log('Cookie Validation Request:', {
            cookieLength: cookie.length,
            timestamp: new Date().toISOString()
        });

        // 验证Cookie并获取Access Token
        const result = await validateCookieAndGetToken(cookie);

        if (result.success) {
            const looksLikeJwt = typeof result.accessToken === 'string' && result.accessToken.includes('.') && result.accessToken.length > 200;
            console.log('Cookie Validation Success:', {
                hasAccessToken: !!result.accessToken,
                looksLikeJwt,
                timestamp: new Date().toISOString()
            });

            // 只有拿到疑似 JWT 的令牌才视为可直接进入第2步
            if (!looksLikeJwt) {
                return {
                    statusCode: 200,
                    headers,
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
                headers,
                body: JSON.stringify({
                    success: true,
                    valid: true,
                    accessToken: result.accessToken,
                    memberId: result.memberId || null,
                    emailSignature: null,
                    message: 'Cookie验证成功'
                })
            };
        } else {
            console.log('Cookie Validation Failed:', {
                message: result.message,
                timestamp: new Date().toISOString()
            });

            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    valid: false,
                    error: 'Unauthorized',
                    message: result.message || 'Cookie验证失败'
                })
            };
        }

    } catch (error) {
        console.error('Cookie Validation Error:', {
            message: error.message,
            timestamp: new Date().toISOString()
        });

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal Server Error',
                message: '服务器内部错误'
            })
        };
    }
};

/**
 * 验证Cookie并获取Access Token
 */
async function validateCookieAndGetToken(cookieString) {
    try {
        // 解析Cookie
        const cookies = parseCookie(cookieString);
        
        if (Object.keys(cookies).length === 0) {
            return {
                success: false,
                message: 'Cookie格式无效'
            };
        }

        // 检查必要的Cookie字段
        const requiredCookies = ['session_token', 'user_id', 'auth_token'];
        const foundCookies = {};
        
        for (const required of requiredCookies) {
            if (cookies[required]) {
                foundCookies[required] = cookies[required];
            }
        }

        // 如果找不到关键Cookie，尝试其他可能的认证Cookie
        if (Object.keys(foundCookies).length === 0) {
            for (const [name, value] of Object.entries(cookies)) {
                const lowerName = name.toLowerCase();
                if (lowerName.includes('token') || 
                    lowerName.includes('session') || 
                    lowerName.includes('auth')) {
                    foundCookies[name] = value;
                }
            }
        }

        if (Object.keys(foundCookies).length === 0) {
            return {
                success: false,
                message: '未找到有效的认证Cookie'
            };
        }

        // 尝试使用Cookie调用Giffgaff API验证
        const { accessToken, memberId } = await callGiffgaffAPI(cookies, cookieString);
        if (accessToken) {
            return { success: true, accessToken, memberId };
        }
        return { success: false, message: 'Cookie已过期或无效' };

    } catch (error) {
        console.error('Cookie validation error:', error);
        return {
            success: false,
            message: '验证过程中发生错误'
        };
    }
}

/**
 * 解析Cookie字符串
 */
function parseCookie(cookieString) {
    const cookies = {};
    const pairs = cookieString.split(';');
    
    for (const pair of pairs) {
        const trimmedPair = pair.trim();
        if (!trimmedPair) continue;
        
        const parts = trimmedPair.split('=');
        if (parts.length >= 2) {
            const name = parts[0].trim();
            // 重要：值中可能包含 '='（如 Base64/签名），需要合并还原
            const value = parts.slice(1).join('=').trim();
            cookies[name] = value;
        }
    }
    
    return cookies;
}

/**
 * 使用Cookie调用Giffgaff API获取Access Token
 */
async function callGiffgaffAPI(cookies, rawCookieString) {
    try {
        // 构建Cookie头
        // 优先使用用户原始 Cookie 串，避免解析/重组导致的字符丢失
        let latestCookies = String(rawCookieString || '').trim();
        if (!latestCookies) {
            latestCookies = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ');
        }

        // 尝试调用Giffgaff Dashboard验证Cookie（跟踪重定向并解析 Set-Cookie）
        const session = axios.create({ maxRedirects: 5, timeout: 30000, validateStatus: () => true });
        let response = await session.get('https://www.giffgaff.com/dashboard', {
            headers: {
                'Cookie': latestCookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.giffgaff.com/',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Dest': 'document',
                'Sec-CH-UA': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': '"Windows"'
            }
        });

        // 整理所有 Set-Cookie 并合并到 latestCookies
        const setCookies = ([]).concat(response.headers['set-cookie'] || []);
        if (setCookies.length) {
            const merged = mergeSetCookies(latestCookies, setCookies);
            latestCookies = merged;
        }

        if (response.status === 200 && response.data) {
            const html = response.data;
            const $ = cheerio.load(html);
            // 登录判断：尽量避免误判
            const text = String(html).toLowerCase();
            const containsLogin = /(sign\s*in|log\s*in|login|id\.giffgaff\.com\/auth)/i.test(text);
            const containsAccount = /(dashboard|my\s*giffgaff|logout|account|profile|settings)/i.test(text);
            const isLoggedIn = containsAccount || (!containsLogin && response.status === 200);
            if (isLoggedIn) {
                // 尝试从 meta 或脚本中提取 memberId
                let memberId = $('meta[name="member-id"]').attr('content') || $('meta[name="giffgaff:member_id"]').attr('content') || null;
                if (!memberId) {
                    const scriptText = $('script').map((_, el) => $(el).html() || '').get().join('\n');
                    const m = scriptText.match(/\bmemberId\b["']?\s*[:=]\s*["']([\w-]{6,})["']/i);
                    if (m) memberId = m[1];
                }

                const tokenLike = findBestTokenFromCookies(cookies);
                if (tokenLike) return { accessToken: tokenLike, memberId };

                const ch = Object.entries(cookies).map(([n, v]) => `${n}=${v}`).join('; ');
                const accessToken = Buffer.from(require('crypto').createHash('md5').update(ch).digest('hex')).toString('base64');
                return { accessToken, memberId };
            }
        }

        // 非明确登录页也尝试放宽：只要存在会话型 Cookie 即视为可用，并回退生成派生 token
        const hasSessionCookie = ['GGUID', 'giffgaff', 'JSESSIONID', 'reese84', 'incap_ses']
          .some((k) => Object.keys(cookies).some((n) => n.toLowerCase().startsWith(k.toLowerCase())));
        if (hasSessionCookie) {
            const tokenLike = findBestTokenFromCookies(cookies);
            if (tokenLike) return { accessToken: tokenLike, memberId: null };
            const ch = Object.entries(cookies).map(([n, v]) => `${n}=${v}`).join('; ');
            const accessToken = Buffer.from(require('crypto').createHash('md5').update(ch).digest('hex')).toString('base64');
            return { accessToken, memberId: null };
        }

        return { accessToken: null, memberId: null };

    } catch (error) {
        console.error('Giffgaff API call error:', error.message);
        return { accessToken: null, memberId: null };
    }

function findBestTokenFromCookies(cookies) {
    const candidates = ['GGUID', 'giffgaff', 'JSESSIONID', 'XSRF-TOKEN', 'access_token', 'id_token', 'reese84'];
    for (const name of candidates) {
        if (cookies[name] && String(cookies[name]).length > 20) return cookies[name];
    }
    for (const [name, value] of Object.entries(cookies)) {
        const lower = name.toLowerCase();
        if ((/token|session|auth/.test(lower)) && String(value).length > 20) return value;
    }
    return null;
}

function mergeSetCookies(originalCookieHeader, setCookieArray) {
    const jar = new Map();
    // 先装入原始 cookie
    originalCookieHeader.split(';').map(s => s.trim()).filter(Boolean).forEach(kv => {
        const [k, v] = kv.split('=');
        if (k && v) jar.set(k.trim(), v.trim());
    });
    // 处理 set-cookie 覆盖
    for (const sc of setCookieArray) {
        const pair = String(sc).split(';')[0];
        const [k, v] = pair.split('=');
        if (k && typeof v !== 'undefined') jar.set(k.trim(), v.trim());
    }
    return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}
}
