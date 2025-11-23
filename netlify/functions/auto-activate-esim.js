/**
 * Netlify Function: eSIM自动激活服务
 * 自动调用Giffgaff激活API完成eSIM激活
 */

const axios = require('axios');

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

    try {
        // 解析请求体
        const requestBody = JSON.parse(event.body || '{}');
        const { activationCode, cookie, accessToken } = requestBody;

        if (!activationCode) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'activationCode参数不能为空'
                })
            };
        }

        console.log('Auto Activation Request:', {
            activationCode: activationCode,
            hasCookie: !!cookie,
            timestamp: new Date().toISOString()
        });

        // 调用Giffgaff激活API
        const result = await callGiffgaffActivationAPI(activationCode, cookie, accessToken);

        if (result.success) {
            console.log('Auto Activation Success:', {
                message: result.message,
                timestamp: new Date().toISOString()
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: result.message,
                    data: result.data
                })
            };
        } else {
            console.log('Auto Activation Failed:', {
                message: result.message,
                timestamp: new Date().toISOString()
            });

            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Activation Failed',
                    message: result.message
                })
            };
        }

    } catch (error) {
        console.error('Auto Activation Error:', {
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
 * 调用Giffgaff激活API - 完整流程
 */
async function callGiffgaffActivationAPI(activationCode, cookieString, bearerToken) {
    try {
        const timestamp = Date.now();
        const defaultHeaders = {
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Sec-Ch-Ua': '"Not;A=Brand";v="99", "Chromium";v="139", "Google Chrome";v="139"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"'
        };
        const cookieHeader = cookieString ? { Cookie: cookieString } : {};
        const bearerHeader = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {};
        const getHeaders = (extra = {}) => ({ ...defaultHeaders, ...cookieHeader, ...bearerHeader, ...extra });
        
        // 第一步：验证激活码（Ajax校验）
        console.log('Step 1: Validating activation code...');
        const validateUrl = `https://www.giffgaff.com/activate/validate-sim-code?code=${activationCode}&next-action=products&_=${timestamp}`;
        
        const validateResponse = await axios.get(validateUrl, {
            headers: getHeaders({
                Accept: 'application/json, text/javascript, */*; q=0.01',
                Referer: 'https://www.giffgaff.com/activate',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'X-Requested-With': 'XMLHttpRequest'
            }),
            timeout: 30000,
            maxRedirects: 5
        });

        console.log('Step 1 Response:', {
            status: validateResponse.status,
            data: validateResponse.data
        });

        if (validateResponse.status !== 200) {
            return {
                success: false,
                message: `激活码验证失败，HTTP状态码: ${validateResponse.status}`
            };
        }

        // 第二步：访问 /activate/swap 预览页面（保持会话）
        console.log('Step 2: Loading swap preview page...');
        const swapPreview = await axios.get('https://www.giffgaff.com/activate/swap', {
            headers: getHeaders({
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                Referer: 'https://www.giffgaff.com/activate',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Upgrade-Insecure-Requests': '1'
            }),
            timeout: 30000,
            maxRedirects: 5
        });

        // 第三步：GET swap-confirm 页面
        console.log('Step 3: Loading swap-confirm page...');
        const swapConfirmGet = await axios.get('https://www.giffgaff.com/activate/swap-confirm', {
            headers: getHeaders({
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                Referer: 'https://www.giffgaff.com/activate/swap',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Upgrade-Insecure-Requests': '1'
            }),
            timeout: 30000,
            maxRedirects: 5
        });

        // 第四步：POST 确认（空体）
        console.log('Step 4: Confirming swap (POST)...');
        // 从 cookie 中提取 XSRF-TOKEN（若存在）
        let xsrf = null;
        if (cookieString) {
            const m = cookieString.match(/XSRF-TOKEN=([^;]+)/);
            if (m) xsrf = decodeURIComponent(m[1]);
        }

        const confirmPost = await axios.post('https://www.giffgaff.com/activate/swap-confirm', null, {
            headers: getHeaders({
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                Origin: 'https://www.giffgaff.com',
                Referer: 'https://www.giffgaff.com/activate/swap-confirm',
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Upgrade-Insecure-Requests': '1'
            }),
            timeout: 30000,
            maxRedirects: 5
        });

        // 若执行到此，表示触发了确认流程。返回成功提示。
        return {
            success: true,
            message: '已提交SIM替换确认，请等待新eSIM生效（通常几分钟）',
            data: {
                previewStatus: swapPreview.status,
                confirmGetStatus: swapConfirmGet.status,
                confirmPostStatus: confirmPost.status
            }
        };

    } catch (error) {
        console.error('Giffgaff Activation API Error:', error.message);
        
        if (error.response) {
            return {
                success: false,
                message: `激活失败: ${error.response.status} - ${error.response.data?.message || '未知错误'}`
            };
        } else {
            return {
                success: false,
                message: `激活请求失败: ${error.message}`
            };
        }
    }
} 
