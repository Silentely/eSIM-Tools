/**
 * Netlify Function: Cookie验证服务
 * 将Giffgaff Cookie转换为Access Token
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
            console.log('Cookie Validation Success:', {
                hasAccessToken: !!result.accessToken,
                timestamp: new Date().toISOString()
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    accessToken: result.accessToken,
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
        const accessToken = await callGiffgaffAPI(cookies);
        
        if (accessToken) {
            return {
                success: true,
                accessToken
            };
        } else {
            return {
                success: false,
                message: 'Cookie已过期或无效'
            };
        }

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
        if (parts.length === 2) {
            const name = parts[0].trim();
            const value = parts[1].trim();
            cookies[name] = value;
        }
    }
    
    return cookies;
}

/**
 * 使用Cookie调用Giffgaff API获取Access Token
 */
async function callGiffgaffAPI(cookies) {
    try {
        // 构建Cookie头
        const cookieHeader = Object.entries(cookies)
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');

        // 尝试调用Giffgaff API验证Cookie
        const response = await axios.get(
            'https://www.giffgaff.com/api/user/profile',
            {
                headers: {
                    'Cookie': cookieHeader,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.giffgaff.com/',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 30000
            }
        );

        if (response.status === 200 && response.data) {
            const data = response.data;
            
            if (data && data.user) {
                // Cookie有效，生成或提取Access Token
                
                // 方法1: 如果API返回token
                if (data.access_token) {
                    return data.access_token;
                }
                
                // 方法2: 使用Cookie中的token
                for (const [name, value] of Object.entries(cookies)) {
                    if (name.toLowerCase().includes('token') && value.length > 20) {
                        return value;
                    }
                }
                
                // 方法3: 生成基于用户信息的临时token（仅用于演示）
                const tokenData = {
                    user_id: data.user.id || 'unknown',
                    timestamp: Date.now(),
                    source: 'cookie_validation'
                };
                
                return Buffer.from(JSON.stringify(tokenData)).toString('base64');
            }
        }

        return null;

    } catch (error) {
        console.error('Giffgaff API call error:', error.message);
        return null;
    }
}