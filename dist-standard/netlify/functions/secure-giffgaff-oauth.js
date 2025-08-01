/**
 * 安全的Giffgaff OAuth处理服务
 * 所有敏感的OAuth操作在后端执行
 */

const crypto = require('crypto');

// 从环境变量获取敏感配置
const GIFFGAFF_CLIENT_ID = process.env.GIFFGAFF_CLIENT_ID || "4a05bf219b3985647d9b9a3ba610a9ce";
const GIFFGAFF_CLIENT_SECRET = process.env.GIFFGAFF_CLIENT_SECRET || "OQv4cfiyol8TvCW4yiLGj0c1AkTR3N2JfRzq7XGqMxk=";
const OAUTH_REDIRECT_URI = "giffgaff://auth/callback/";
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
            case 'initiate':
                return await initiateOAuth(headers);
            case 'complete':
                return await completeOAuth(data, headers);
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }
    } catch (error) {
        console.error('OAuth处理错误:', error);
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

async function initiateOAuth(headers) {
    try {
        // 生成PKCE参数
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const state = generateState();
        
        // 存储会话信息
        const sessionId = Date.now().toString();
        sessions.set(sessionId, {
            codeVerifier,
            state,
            timestamp: Date.now()
        });

        // 构建授权URL
        const authUrl = new URL('https://id.giffgaff.com/auth/oauth/authorize');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', GIFFGAFF_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
        authUrl.searchParams.set('scope', 'read');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                authUrl: authUrl.toString(),
                sessionId: sessionId
            })
        };
    } catch (error) {
        console.error('OAuth初始化错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to initiate OAuth' })
        };
    }
}

async function completeOAuth(data, headers) {
    try {
        const { callbackUrl, sessionId } = data;
        
        // 验证会话
        const session = sessions.get(sessionId);
        if (!session) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid session' })
            };
        }

        // 解析回调URL
        const url = new URL(callbackUrl);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (!code || state !== session.state) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid callback parameters' })
            };
        }

        // 交换访问令牌
        const tokenResponse = await fetch('https://id.giffgaff.com/auth/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(GIFFGAFF_CLIENT_ID + ':' + GIFFGAFF_CLIENT_SECRET).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: OAUTH_REDIRECT_URI,
                code_verifier: session.codeVerifier,
                client_id: GIFFGAFF_CLIENT_ID
            })
        });

        if (!tokenResponse.ok) {
            throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        
        // 清理会话
        sessions.delete(sessionId);

        // 返回加密的访问令牌
        const encryptedToken = encryptData(tokenData.access_token);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                accessToken: encryptedToken,
                expiresIn: tokenData.expires_in
            })
        };
    } catch (error) {
        console.error('OAuth完成错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to complete OAuth' })
        };
    }
}

function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState() {
    return crypto.randomBytes(16).toString('hex');
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