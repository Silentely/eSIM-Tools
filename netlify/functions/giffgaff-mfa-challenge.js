/**
 * Netlify Function: Giffgaff MFA Challenge
 * 处理MFA邮件验证码发送请求，解决CORS和403问题
 */

const axios = require('axios');

exports.handler = async (event, context) => {
    // CORS 允许域（默认仅允许生产域名）
    const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://esim.cosr.eu.org';
    const lowerCaseHeaders = Object.fromEntries(
        Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
    );
    const requestOrigin = lowerCaseHeaders['origin'];

    const ACCESS_KEY = process.env.ACCESS_KEY || process.env.ESIM_ACCESS_KEY;
    const getProvidedKey = () => {
        const fromHeader = lowerCaseHeaders['x-esim-key'] || lowerCaseHeaders['x-app-key'] || '';
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
        // 解析请求体
        const requestBody = JSON.parse(event.body || '{}');
        // 通过 authKey 校验已经在入口进行，这里不需要额外动作
        const { source = "esim", preferredChannels = ["EMAIL"], cookie } = requestBody;

        // 从请求体或 Authorization 头提取 accessToken（兼容两种方式）
        const lowerCaseHeaders = Object.fromEntries(
            Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
        );
        const authHeader = lowerCaseHeaders['authorization'] || '';
        let accessToken = requestBody.accessToken;
        if (!accessToken && authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.slice(7);
        }

        if (!accessToken && !cookie) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'accessToken 或 cookie 至少提供一个'
                })
            };
        }
        
    // 站点URL用于内部调用 verify-cookie（避免硬编码域名）
    const lowerCaseHeadersForUrl = Object.fromEntries(
        Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
    );
    const hostHeader = lowerCaseHeadersForUrl['x-forwarded-host'] || lowerCaseHeadersForUrl['host'] || '';
    const protoHeader = lowerCaseHeadersForUrl['x-forwarded-proto'] || 'https';
    const verifyCookieUrl = hostHeader ? `${protoHeader}://${hostHeader}/.netlify/functions/verify-cookie` : ((process.env.URL || '').replace(/\/$/, '') + '/.netlify/functions/verify-cookie');

    // 如果提供cookie但没有accessToken，先尝试使用cookie获取accessToken
        let mergedCookie = cookie || '';
        if (cookie) {
            // 预热：访问 dashboard 刷新并合并 Set-Cookie，提高 id.giffgaff.com 接口成功率
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
                console.warn('Dashboard warm-up failed:', e.message);
            }
            // 若还没有 access token，则尝试一次 verify-cookie
            if (!accessToken) {
                try {
                    const cookieVerifyResponse = await axios.post(verifyCookieUrl, { cookie: mergedCookie }, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 30000
                    });
                    if (cookieVerifyResponse.data?.success && cookieVerifyResponse.data?.accessToken) {
                        accessToken = cookieVerifyResponse.data.accessToken;
                        console.log('Successfully obtained access token from merged cookie');
                    }
                } catch (cookieError) {
                    console.error('Failed to verify merged cookie:', cookieError.message);
                }
            }
        }

        console.log('MFA Challenge Request:', {
            source,
            preferredChannels,
            tokenLength: accessToken ? accessToken.length : 0,
            hasCookie: !!cookie,
            timestamp: new Date().toISOString()
        });

        // 调用Giffgaff MFA API，失败且令牌过期时，尝试用cookie刷新一次
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
                console.warn('Fetch CSRF failed:', e.message);
            }
        }

        // 从 mergedCookie 中提取 XSRF-TOKEN，作为 x-xsrf-token 头
        let xxsrf = null;
        if (mergedCookie) {
            const m = String(mergedCookie).match(/XSRF-TOKEN=([^;]+)/);
            if (m) xxsrf = decodeURIComponent(m[1]);
        }

        // Web(Cookie)通道：auth/v3/mfa/challenge（method: 'text' | 'email'）
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

        // App(Token)通道：v4 使用真实的 iOS App UA
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
            // 优先走 Cookie 的 Web 通道（更契合 Cookie 登录）
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
                        // 非JWT样式（无点号或长度过短）时，强制使用cookie通道
                        const looksLikeJwt = typeof refreshed === 'string' && refreshed.includes('.') && refreshed.length > 200;
                        if (!looksLikeJwt) {
                            refreshed = null;
                        }
                        console.log('Refreshed access token via cookie, retrying MFA challenge');
                        if (refreshed) response = await sendChallengeV4Token(refreshed);
                        else response = await sendChallengeV3Cookie();
                    } else {
                        throw err;
                    }
                } catch (reErr) {
                    // 多次失败提示客户端需要刷新登录/重新获取Cookie
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({
                            error: 'MFA Challenge Failed',
                            message: 'Access token expired. Please re-login with cookie.',
                            details: data,
                            needReLogin: true
                        })
                    };
                }
            } else {
                throw err;
            }
        }

        console.log('MFA Challenge Success:', {
            status: response.status,
            hasRef: !!response.data.ref,
            channel: Array.isArray(preferredChannels) ? preferredChannels[0] : 'EMAIL',
            timestamp: new Date().toISOString()
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response.data)
        };

    } catch (error) {
        console.error('MFA Challenge Error:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            timestamp: new Date().toISOString()
        });

        const status = error.response?.status || 500;
        const errorMessage = error.response?.data?.message || error.message || '未知错误';

        return {
            statusCode: status,
            headers,
            body: JSON.stringify({
                error: 'MFA Challenge Failed',
                message: errorMessage,
                details: error.response?.data || null
            })
        };
    }
};

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
