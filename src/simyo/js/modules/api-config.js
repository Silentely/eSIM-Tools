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
    clientVersion: "4.8.0",
    userAgent: "MijnSimyo/4.8.0 (iPhone; iOS 17.5.1; Scale/3.00)"
};

/**
 * API端点配置
 */
export function getApiEndpoints() {
    const isNetlify = isNetlifyEnvironment();
    
    return {
        // 认证相关
        login: isNetlify 
            ? "/api/simyo/sessions" 
            : "http://localhost:3000/api/simyo/sessions",
        
        // eSIM相关
        getEsim: isNetlify 
            ? "/api/simyo/esim/get-by-customer" 
            : "http://localhost:3000/api/simyo/esim/get-by-customer",
        
        // 设备更换相关
        applyNewEsim: isNetlify 
            ? "/api/simyo/esim/apply-new-esim" 
            : "http://localhost:3000/api/simyo/esim/apply-new-esim",
        sendSmsCode: isNetlify 
            ? "/api/simyo/esim/send-sms-code" 
            : "http://localhost:3000/api/simyo/esim/send-sms-code",
        verifyCode: isNetlify 
            ? "/api/simyo/esim/verify-code" 
            : "http://localhost:3000/api/simyo/esim/verify-code",
        
        // 安装确认
        confirmInstall: isNetlify 
            ? "/api/simyo/esim/reorder-profile-installed" 
            : "http://localhost:3000/api/simyo/esim/reorder-profile-installed",
        
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
    const data = await response.json();
    
    // 适配不同环境的响应格式
    const isNetlify = isNetlifyEnvironment();
    
    if (isNetlify) {
        // Netlify环境：直接从Simyo API响应获取
        return data;
    } else {
        // 本地代理环境：从包装的响应获取
        if (data.success && data.result) {
            return data;
        } else {
            throw new Error(data.message || data.error || t('simyo.api.error.generic'));
        }
    }
}
