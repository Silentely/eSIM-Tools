/**
 * Netlify Function: Giffgaff MFA Validation
 * 处理MFA邮件验证码验证请求
 */

const axios = require('axios');

exports.handler = async (event, context) => {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    // 不限制来源

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
        const { ref, code, cookie } = requestBody;

        // 从请求体或 Authorization 头提取 accessToken（兼容两种方式）
        const lowerCaseHeaders = Object.fromEntries(
            Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
        );
        const authHeader = lowerCaseHeaders['authorization'] || '';
        let accessToken = requestBody.accessToken;
        if (!accessToken && authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.slice(7);
        }

        if ((!accessToken && !cookie) || !ref || !code) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'accessToken 或 cookie 与 ref, code 都是必需的'
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
        if (cookie && !accessToken) {
            try {
                // 调用verify-cookie函数获取accessToken
            const cookieVerifyResponse = await axios.post(verifyCookieUrl, { cookie }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });
                
                if (cookieVerifyResponse.data && cookieVerifyResponse.data.success && cookieVerifyResponse.data.accessToken) {
                    accessToken = cookieVerifyResponse.data.accessToken;
                    console.log('Successfully obtained access token from cookie');
                }
            } catch (cookieError) {
                console.error('Failed to verify cookie:', cookieError.message);
                // 继续使用原始cookie
            }
        }

        console.log('MFA Validation Request:', {
            ref,
            codeLength: code.length,
            tokenLength: accessToken ? accessToken.length : 0,
            hasCookie: !!cookie,
            timestamp: new Date().toISOString()
        });

        // 调用Giffgaff MFA验证API，失败且令牌过期时，尝试用cookie刷新一次
        const sendValidation = async (token) => axios.post(
            'https://id.giffgaff.com/v4/mfa/validation',
            { ref, code },
            {
                headers: (() => {
                    const h = {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Origin': 'https://www.giffgaff.com',
                        'Referer': 'https://www.giffgaff.com/',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
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
            const isExpired = status === 401 && (data.error === 'invalid_token' || /expired/i.test(String(data.error_description || '')));
            if (isExpired && cookie) {
                try {
                    const cookieVerifyResponse = await axios.post(verifyCookieUrl, { cookie }, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 30000
                    });
                    if (cookieVerifyResponse.data?.success && cookieVerifyResponse.data?.accessToken) {
                        const refreshed = cookieVerifyResponse.data.accessToken;
                        console.log('Refreshed access token via cookie, retrying MFA validation');
                        response = await sendValidation(refreshed);
                    } else {
                        throw err;
                    }
                } catch (reErr) {
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({
                            error: 'MFA Validation Failed',
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

        console.log('MFA Validation Success:', {
            status: response.status,
            hasSignature: !!response.data.signature,
            timestamp: new Date().toISOString()
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response.data)
        };

    } catch (error) {
        console.error('MFA Validation Error:', {
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
                error: 'MFA Validation Failed',
                message: errorMessage,
                details: error.response?.data || null
            })
        };
    }
};