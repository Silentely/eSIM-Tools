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
        const { accessToken, ref, code } = requestBody;

        if (!accessToken || !ref || !code) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'accessToken, ref, code都是必需的'
                })
            };
        }

        console.log('MFA Validation Request:', {
            ref,
            codeLength: code.length,
            tokenLength: accessToken.length,
            timestamp: new Date().toISOString()
        });

        // 调用Giffgaff MFA验证API
        const response = await axios.post(
            'https://id.giffgaff.com/v4/mfa/validation',
            {
                ref,
                code
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://www.giffgaff.com',
                    'Referer': 'https://www.giffgaff.com/',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 30000
            }
        );

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