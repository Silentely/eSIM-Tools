/**
 * Netlify Function: eSIM自动激活服务
 * 自动调用Giffgaff激活API完成eSIM激活
 */

const axios = require('axios');
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');

// 输入验证schema
const autoActivateSchema = {
  activationCode: {
    required: true,
    type: 'string',
    minLength: 6,
    maxLength: 50
  }
};

exports.handler = withAuth(async (event, context, { auth, body }) => {
  // 输入验证
  validateInput(autoActivateSchema, body);

  const { activationCode, cookie, accessToken } = body;

  // 调用Giffgaff激活API
  const result = await callGiffgaffActivationAPI(activationCode, cookie, accessToken);

  if (result.success) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: result.message,
        data: result.data
      })
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: 'Activation Failed',
        message: result.message
      })
    };
  }
}, { validateSchema: autoActivateSchema });

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

    // 第一步：验证激活码
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

    if (validateResponse.status !== 200) {
      return {
        success: false,
        message: `激活码验证失败,HTTP状态码: ${validateResponse.status}`
      };
    }

    // 第二步：访问 /activate/swap 预览页面
    await axios.get('https://www.giffgaff.com/activate/swap', {
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
    await axios.get('https://www.giffgaff.com/activate/swap-confirm', {
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

    // 第四步：POST 确认
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

    return {
      success: true,
      message: '已提交SIM替换确认,请等待新eSIM生效（通常几分钟）',
      data: {
        confirmPostStatus: confirmPost.status
      }
    };

  } catch (error) {
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
