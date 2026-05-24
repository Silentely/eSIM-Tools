/**
 * Simyo API配置模块
 * 定义所有API端点和请求配置
 */

import { isNetlifyEnvironment } from './utils.js';
import { t } from '../../../js/modules/i18n.js';

/**
 * Simyo客户端配置
 */
export const simyoConfig = {
    clientToken: "e77b7e2f43db41bb95b17a2a11581a38",
    clientPlatform: "ios",
    clientVersion: "4.23.5",
    userAgent: "MijnSimyoFT/4.23.5 (iOS 26.3; iPhone16,1)"
};

/**
 * API端点配置
 */
export function getApiEndpoints() {
    const isNetlify = isNetlifyEnvironment();
    const isBrowserServed = typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
    const localBase = isBrowserServed ? '' : 'http://localhost:3000';

    return {
        // 认证相关
        login: isNetlify
            ? "/api/simyo/sessions"
            : `${localBase}/api/simyo/sessions`,

        // eSIM相关
        getEsim: isNetlify
            ? "/api/simyo/esim/get-by-customer"
            : `${localBase}/api/simyo/esim/get-by-customer`,

        // 设备更换相关
        applyNewEsim: isNetlify
            ? "/api/simyo/settings/simcard"
            : `${localBase}/api/simyo/settings/simcard`,
        verifyCode: isNetlify
            ? "/api/simyo/esim/verify-code"
            : `${localBase}/api/simyo/esim/verify-code`,

        // 新增：查询可用的验证方式 (v2 API)
        availableValidationMethods: isNetlify
            ? "/api/simyo/esim.availableValidationMethods"
            : `${localBase}/api/simyo/esim.availableValidationMethods`,

        // 安装确认
        confirmInstall: isNetlify
            ? "/api/simyo/esim/reorder-profile-installed"
            : `${localBase}/api/simyo/esim/reorder-profile-installed`,

        // 二维码服务
        qrcode: "https://qrcode.show/"
    };
}

/**
 * 创建API请求头
 * @param {boolean} includeSession - 是否包含session token
 * @param {string} sessionToken - session token值
 */
export function createHeaders(includeSession = false, sessionToken = "") {
    const headers = {
        'Content-Type': 'application/json',
        'X-Client-Token': simyoConfig.clientToken,
        'X-Client-Platform': simyoConfig.clientPlatform,
        'X-Client-Version': simyoConfig.clientVersion,
        'User-Agent': simyoConfig.userAgent
    };

    if (includeSession && sessionToken) {
        headers['X-Session-Token'] = sessionToken;
    }

    return headers;
}

/**
 * 处理API响应
 * @param {Response} response - Fetch API响应对象
 */
export async function handleApiResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
        try {
            data = await response.json();
        } catch (e) {
            // JSON 解析失败（空体/坏体），回退为空对象
            data = {};
        }
    } else {
        data = { message: await response.text() };
    }

    // 先处理 HTTP 错误，尽量透传服务端信息
    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            data.reason ||
            `HTTP ${response.status}`
        );
    }

    // 非 JSON 响应直接返回文本内容
    if (!contentType.includes('application/json')) {
        return { success: true, result: data };
    }

    // 统一兼容三种返回格式：
    // 1. 本地旧代理包装: { success, result, message }
    // 2. 直通 Simyo: { result: {...} }
    // 3. Simyo 展平成功结构: { success: true, ... }
    if (data.success === true && data.result) {
        return data;
    }

    if (data.result) {
        const nestedSuccess = data.result.success;
        return {
            success: nestedSuccess === true,
            result: data.result,
            message: data.message || data.result.message || data.result.reason
        };
    }

    if (data.success === true) {
        return {
            success: true,
            result: data,
            message: data.message || data.reason
        };
    }

    throw new Error(data.message || data.error || data.reason || t('simyo.api.error.generic'));
}
