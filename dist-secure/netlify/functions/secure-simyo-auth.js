/**
 * 安全的Simyo认证和eSIM操作服务
 * 所有敏感操作在后端执行
 */

const crypto = require('crypto');
const axios = require('axios');

// 从环境变量获取敏感配置
const SIMYO_CLIENT_TOKEN = process.env.SIMYO_CLIENT_TOKEN || "e77b7e2f43db41bb95b17a2a11581a38";
const SIMYO_CLIENT_PLATFORM = "ios";
const SIMYO_CLIENT_VERSION = "4.8.0";
const SIMYO_USER_AGENT = "MijnSimyo/4.8.0 (iPhone; iOS 17.5.1; Scale/3.00)";
const SESSION_SECRET = process.env.SESSION_SECRET || "your-super-secret-key-change-in-production";

// 内存存储（生产环境应使用Redis或数据库）
const sessions = new Map();

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID, X-Timestamp, X-Signature',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { action, ...data } = JSON.parse(event.body || '{}');
        
        // 验证请求签名
        if (!verifySignature(event.headers, data)) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Invalid signature' })
            };
        }

        switch (action) {
            case 'login':
                return await handleLogin(data, headers);
            case 'getESIM':
                return await handleGetESIM(data, headers);
            case 'applyNewESIM':
                return await handleApplyNewESIM(data, headers);
            case 'sendSMSCode':
                return await handleSendSMSCode(data, headers);
            case 'verifyCode':
                return await handleVerifyCode(data, headers);
            case 'confirmInstall':
                return await handleConfirmInstall(data, headers);
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }
    } catch (error) {
        console.error('Simyo服务错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

function verifySignature(headers, data) {
    const sessionId = headers['x-session-id'];
    const timestamp = headers['x-timestamp'];
    const signature = headers['x-signature'];
    
    if (!sessionId || !timestamp || !signature) {
        return false;
    }

    // 检查时间戳（防止重放攻击）
    const now = Date.now();
    if (Math.abs(now - parseInt(timestamp)) > 300000) { // 5分钟
        return false;
    }

    // 验证签名
    const message = JSON.stringify(data) + sessionId;
    const expectedSignature = crypto.createHash('sha256').update(message).digest('hex');
    
    return signature === expectedSignature;
}

async function handleLogin(data, headers) {
    try {
        const { phoneNumber, password: encryptedPassword } = data;
        
        // 解密密码（简单示例，生产环境应使用更强的加密）
        const password = decryptPassword(encryptedPassword, data.sessionId);
        
        // 验证输入
        if (!phoneNumber || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing credentials' })
            };
        }

        // 调用Simyo API
        const response = await axios.post('https://appapi.simyo.nl/simyoapi/api/v1/sessions', {
            phoneNumber,
            password
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Token': SIMYO_CLIENT_TOKEN,
                'X-Client-Platform': SIMYO_CLIENT_PLATFORM,
                'X-Client-Version': SIMYO_CLIENT_VERSION,
                'User-Agent': SIMYO_USER_AGENT
            },
            timeout: 30000
        });

        if (response.data && response.data.result && response.data.result.sessionToken) {
            // 加密并存储会话令牌
            const encryptedSessionToken = encryptData(response.data.result.sessionToken);
            
            // 存储会话信息
            sessions.set(data.sessionId, {
                sessionToken: response.data.result.sessionToken,
                phoneNumber,
                timestamp: Date.now()
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    sessionToken: encryptedSessionToken
                })
            };
        } else {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid credentials' })
            };
        }
    } catch (error) {
        console.error('Simyo登录错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Login failed' })
        };
    }
}

async function handleGetESIM(data, headers) {
    try {
        const session = sessions.get(data.sessionId);
        if (!session) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid session' })
            };
        }

        const response = await axios.get('https://appapi.simyo.nl/simyoapi/api/v1/esim/get-by-customer', {
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Token': SIMYO_CLIENT_TOKEN,
                'X-Client-Platform': SIMYO_CLIENT_PLATFORM,
                'X-Client-Version': SIMYO_CLIENT_VERSION,
                'X-Session-Token': session.sessionToken,
                'User-Agent': SIMYO_USER_AGENT
            },
            timeout: 30000
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: response.data
            })
        };
    } catch (error) {
        console.error('获取eSIM错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to get eSIM' })
        };
    }
}

async function handleApplyNewESIM(data, headers) {
    try {
        const session = sessions.get(data.sessionId);
        if (!session) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid session' })
            };
        }

        const { isDeviceChange } = data;
        const endpoint = isDeviceChange ? 
            'https://appapi.simyo.nl/simyoapi/api/v1/esim/apply-new-esim' :
            'https://appapi.simyo.nl/simyoapi/api/v1/esim/apply-new-esim';

        const response = await axios.post(endpoint, {
            isDeviceChange: isDeviceChange || false
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Token': SIMYO_CLIENT_TOKEN,
                'X-Client-Platform': SIMYO_CLIENT_PLATFORM,
                'X-Client-Version': SIMYO_CLIENT_VERSION,
                'X-Session-Token': session.sessionToken,
                'User-Agent': SIMYO_USER_AGENT
            },
            timeout: 30000
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: response.data
            })
        };
    } catch (error) {
        console.error('申请eSIM错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to apply for eSIM' })
        };
    }
}

async function handleSendSMSCode(data, headers) {
    try {
        const session = sessions.get(data.sessionId);
        if (!session) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid session' })
            };
        }

        const response = await axios.post('https://appapi.simyo.nl/simyoapi/api/v1/esim/send-sms-code', {}, {
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Token': SIMYO_CLIENT_TOKEN,
                'X-Client-Platform': SIMYO_CLIENT_PLATFORM,
                'X-Client-Version': SIMYO_CLIENT_VERSION,
                'X-Session-Token': session.sessionToken,
                'User-Agent': SIMYO_USER_AGENT
            },
            timeout: 30000
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: response.data
            })
        };
    } catch (error) {
        console.error('发送短信验证码错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to send SMS code' })
        };
    }
}

async function handleVerifyCode(data, headers) {
    try {
        const session = sessions.get(data.sessionId);
        if (!session) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid session' })
            };
        }

        const { code } = data;
        const response = await axios.post('https://appapi.simyo.nl/simyoapi/api/v1/esim/verify-code', {
            code
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Token': SIMYO_CLIENT_TOKEN,
                'X-Client-Platform': SIMYO_CLIENT_PLATFORM,
                'X-Client-Version': SIMYO_CLIENT_VERSION,
                'X-Session-Token': session.sessionToken,
                'User-Agent': SIMYO_USER_AGENT
            },
            timeout: 30000
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: response.data
            })
        };
    } catch (error) {
        console.error('验证码验证错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to verify code' })
        };
    }
}

async function handleConfirmInstall(data, headers) {
    try {
        const session = sessions.get(data.sessionId);
        if (!session) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid session' })
            };
        }

        const { activationCode } = data;
        const response = await axios.post('https://appapi.simyo.nl/simyoapi/api/v1/esim/reorder-profile-installed', {
            activationCode
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Token': SIMYO_CLIENT_TOKEN,
                'X-Client-Platform': SIMYO_CLIENT_PLATFORM,
                'X-Client-Version': SIMYO_CLIENT_VERSION,
                'X-Session-Token': session.sessionToken,
                'User-Agent': SIMYO_USER_AGENT
            },
            timeout: 30000
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: response.data
            })
        };
    } catch (error) {
        console.error('确认安装错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to confirm installation' })
        };
    }
}

function decryptPassword(encryptedPassword, sessionId) {
    // 简单的解密示例（生产环境应使用更强的加密）
    const hash = crypto.createHash('sha256').update(encryptedPassword + sessionId).digest('hex');
    return hash; // 这里应该实现真正的解密逻辑
}

function encryptData(data) {
    const cipher = crypto.createCipher('aes-256-cbc', SESSION_SECRET);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptData(encryptedData) {
    const decipher = crypto.createDecipher('aes-256-cbc', SESSION_SECRET);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}