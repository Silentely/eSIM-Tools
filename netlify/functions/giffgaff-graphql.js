/**
 * Netlify Function: Giffgaff GraphQL API
 * 处理GraphQL请求，解决CORS问题
 */

const axios = require('axios');

exports.handler = async (event, context) => {
    // CORS 允许域（默认仅允许生产域名）
    const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://esim.cosr.eu.org';
    const lower = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v]));
    const requestOrigin = lower['origin'];

    const ACCESS_KEY = process.env.ACCESS_KEY || process.env.ESIM_ACCESS_KEY || '';
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

    const headers = {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MFA-Signature',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
        'Content-Type': 'application/json'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        // 仅允许指定来源的预检
        if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden', message: 'Origin not allowed' }) };
        }
        return { statusCode: 200, headers, body: '' };
    }

    // 非预检：限制来源（无 Origin 视为服务端调用，放行）
    if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden', message: 'Origin not allowed' }) };
    }

    // 鉴权参数校验（若配置了 ACCESS_KEY 则要求提供）
    if (ACCESS_KEY) {
        const provided = getProvidedKey();
        if (!provided || provided !== ACCESS_KEY) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized', message: 'Missing or invalid auth key' }) };
        }
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
        // 解析请求体（支持对象和数组两种格式）
        let parsedBody = JSON.parse(event.body || '{}');
        
        // 如果是数组格式，取第一个元素
        if (Array.isArray(parsedBody)) {
            if (parsedBody.length === 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Bad Request',
                        message: 'GraphQL请求数组不能为空'
                    })
                };
            }
            parsedBody = parsedBody[0];
        }
        
        const requestBody = parsedBody;
        const { mfaSignature, mfaRef, query, variables, operationName, cookie } = requestBody;

        // 从请求体或 Authorization 头提取 accessToken（兼容两种方式）
        const lowerCaseHeaders = Object.fromEntries(
            Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
        );
        const authHeader = lowerCaseHeaders['authorization'] || '';
        let accessToken = requestBody.accessToken;
        if (!accessToken && authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.slice(7);
        }

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

        // 构建请求头（使用真实的 iOS App UA 和头部）
        const requestHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'Accept': '*/*',
            'User-Agent': process.env.GG_USER_AGENT || 'giffgaff/1332 CFNetwork/1568.300.101 Darwin/24.2.0',
            'Origin': 'https://publicapi.giffgaff.com',
            'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br'
        };

        // 针对 reserveESim / swapSim / eSimDownloadToken 需要设备元数据头（使用 HAR 中的真实值）
        const opName = operationName || '';
        const isReserve = /reserveESim\s*\(/.test(String(query || '')) || /reserveESim/i.test(opName);
        const isSwap = /swapSim\s*\(/i.test(String(query || '')) || /swapSim/i.test(opName);
        const isToken = /eSimDownloadToken\s*\(/i.test(String(query || '')) || /eSimDownloadToken/i.test(opName);
        const isMfaChallenge = /simSwapMfaChallenge/i.test(String(query || '')) || /simSwapMfaChallenge/i.test(opName);
        const needsAppHeaders = isReserve || isSwap || isToken || isMfaChallenge;
        
        if (needsAppHeaders) {
            // 使用 HAR 抓包中的真实 iOS App 头部
            requestHeaders['x-gg-app-device-manufacturer'] = process.env.GG_APP_DEVICE_MANUFACTURER || 'Apple';
            requestHeaders['x-gg-app-os'] = process.env.GG_APP_OS || 'iOS';
            requestHeaders['x-gg-app-version'] = process.env.GG_APP_VERSION || '17.46.11';
            requestHeaders['x-gg-app-build-number'] = process.env.GG_APP_BUILD_NUMBER || '1332';
            requestHeaders['x-gg-app-os-version'] = process.env.GG_APP_OS_VERSION || '18.2';
            requestHeaders['apollographql-client-name'] = process.env.APOLLO_CLIENT_NAME || 'iOS 18.2';
            requestHeaders['apollographql-client-version'] = process.env.APOLLO_CLIENT_VERSION || '17.46.11 1332';
            requestHeaders['x-gg-app-bundle-version'] = process.env.GG_APP_BUNDLE_VERSION || 'v0';
            requestHeaders['x-gg-app-device-model'] = process.env.GG_APP_DEVICE_MODEL || 'iPhone SE';
            requestHeaders['x-gg-app-device-id'] = process.env.GG_APP_DEVICE_ID || 'iPhone12,8';
            requestHeaders['baggage'] = process.env.GG_BAGGAGE || 'client-tracking-ctx-id=d1c9ee72-573b-490e-a219-6b41992a5bdb';
            
            try {
                const { randomUUID } = require('crypto');
                requestHeaders['x-request-id'] = randomUUID();
            } catch (_) {}
        }

        // 如果有MFA签名，添加到请求头（swapSim 只需要签名，不需要 ref）
        if (mfaSignature) {
            requestHeaders['X-MFA-Signature'] = mfaSignature;
            requestHeaders['x-mfa-signature'] = mfaSignature;
        }

        // 构建GraphQL请求体
        const graphqlBody = {
            query,
            variables: variables || {},
            operationName: operationName || null
        };

        // 供失败时刷新令牌使用的 verify-cookie 地址
        const hostHdr = lowerCaseHeaders['x-forwarded-host'] || lowerCaseHeaders['host'] || '';
        const protoHdr = lowerCaseHeaders['x-forwarded-proto'] || 'https';
        const verifyCookieUrl = hostHdr ? `${protoHdr}://${hostHdr}/.netlify/functions/verify-cookie` : ((process.env.URL || '').replace(/\/$/, '') + '/.netlify/functions/verify-cookie');

        // 小范围调试日志：输出将发送的关键头（不含敏感 Authorization）
        try {
            const debugHeaders = {
                'X-MFA-Signature': requestHeaders['X-MFA-Signature'] || requestHeaders['x-mfa-signature'] || requestHeaders['X-GG-MFA-SIGNATURE'] || requestHeaders['x-gg-mfa-signature'] || null,
                'X-GG-MFA-REF': requestHeaders['X-GG-MFA-REF'] || requestHeaders['x-gg-mfa-ref'] || requestHeaders['X-MFA-REF'] || requestHeaders['x-mfa-ref'] || null,
                'x-gg-app-os': requestHeaders['x-gg-app-os'] || null,
                'x-gg-app-build-number': requestHeaders['x-gg-app-build-number'] || null
            };
        console.log('GraphQL Outgoing Headers (debug):', debugHeaders);
        } catch (_) {}

        // 调用Giffgaff GraphQL API（失败 401 时尝试用 cookie 刷新后重试一次）
        let response;
        try {
            response = await axios.post(
                'https://publicapi.giffgaff.com/gateway/graphql',
                graphqlBody,
                { headers: requestHeaders, timeout: 30000 }
            );
        } catch (err) {
            const status = err.response?.status;
            const data = err.response?.data || {};
            const isUnauthorized = status === 401 || data?.error === 'unauthorized' || /invalid_token/i.test(String(data?.error || ''));
            if (isUnauthorized && cookie) {
                try {
                    const r = await axios.post(verifyCookieUrl, { cookie }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
                    if (r.data?.success && r.data?.accessToken) {
                        accessToken = r.data.accessToken;
                        requestHeaders['Authorization'] = `Bearer ${accessToken}`;
                        response = await axios.post(
                            'https://publicapi.giffgaff.com/gateway/graphql',
                            graphqlBody,
                            { headers: requestHeaders, timeout: 30000 }
                        );
                    } else {
                        throw err;
                    }
                } catch (reErr) {
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({
                            error: 'GraphQL Request Failed',
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