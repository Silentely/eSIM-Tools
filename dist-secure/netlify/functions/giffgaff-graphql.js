/**
 * Netlify Function: Giffgaff GraphQL API
 * 处理GraphQL请求，解决CORS问题
 */

const axios = require('axios');

exports.handler = async (event, context) => {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MFA-Signature',
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
        const { accessToken, mfaSignature, query, variables, operationName } = requestBody;

        if (!accessToken) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'accessToken是必需的'
                })
            };
        }

        if (!query) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'GraphQL query是必需的'
                })
            };
        }

        console.log('GraphQL Request:', {
            operationName: operationName || 'Unknown',
            hasVariables: !!variables,
            hasMfaSignature: !!mfaSignature,
            tokenLength: accessToken.length,
            timestamp: new Date().toISOString()
        });

        // 构建请求头
        const requestHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://www.giffgaff.com',
            'Referer': 'https://www.giffgaff.com/',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        // 如果有MFA签名，添加到请求头
        if (mfaSignature) {
            requestHeaders['X-MFA-Signature'] = mfaSignature;
        }

        // 构建GraphQL请求体
        const graphqlBody = {
            query,
            variables: variables || {},
            operationName: operationName || null
        };

        // 调用Giffgaff GraphQL API
        const response = await axios.post(
            'https://publicapi.giffgaff.com/gateway/graphql',
            graphqlBody,
            {
                headers: requestHeaders,
                timeout: 30000
            }
        );

        console.log('GraphQL Success:', {
            status: response.status,
            hasData: !!response.data.data,
            hasErrors: !!response.data.errors,
            timestamp: new Date().toISOString()
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response.data)
        };

    } catch (error) {
        console.error('GraphQL Error:', {
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
                error: 'GraphQL Request Failed',
                message: errorMessage,
                details: error.response?.data || null
            })
        };
    }
};