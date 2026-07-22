/**
 * Simyo API配置模块
 * 定义所有API端点和请求配置
 *
 * 请求头字段对齐官方 Mijn Simyo iOS 4.28.0 抓包：
 * X-Client-Token / X-Client-Platform / X-Client-Version / X-Device-ID / User-Agent
 */

import { isNetlifyEnvironment } from './utils.js';
import { t } from '../../../js/modules/i18n.js';

/** localStorage 键：持久化设备 ID，模拟 iOS identifierForVendor */
const DEVICE_ID_STORAGE_KEY = 'simyo_device_id';

/**
 * Simyo客户端配置（与官方 App 抓包一致）
 */
export const simyoConfig = {
    clientToken: 'e77b7e2f43db41bb95b17a2a11581a38',
    clientPlatform: 'ios',
    clientVersion: '4.28.0',
    // 官方 UA 在版本号后有两个空格
    userAgent: 'MijnSimyoFT/4.28.0  (iOS 27.0; iPhone16,1)'
};

/**
 * 生成 UUID v4（大写，对齐 iOS X-Device-ID 形态）
 * @returns {string}
 */
function generateUuidV4() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().toUpperCase();
    }
    // 无 crypto.randomUUID 时的回退（仍保证 RFC4122 形态）
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i += 1) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return (
        hex.slice(0, 8) +
        '-' +
        hex.slice(8, 12) +
        '-' +
        hex.slice(12, 16) +
        '-' +
        hex.slice(16, 20) +
        '-' +
        hex.slice(20)
    ).toUpperCase();
}

/**
 * 获取或创建稳定的 X-Device-ID
 * 官方 App 每个请求都携带 UUID 形态的设备 ID；缺失会返回 400 missing X-Device-ID
 * @returns {string}
 */
export function getOrCreateDeviceId() {
    try {
        if (typeof localStorage !== 'undefined') {
            const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
            if (existing && /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(existing)) {
                return existing.toUpperCase();
            }
            const created = generateUuidV4();
            localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
            return created;
        }
    } catch (_) {
        // 隐私模式 / 存储不可用时降级为会话内 ID
    }
    if (!getOrCreateDeviceId._sessionId) {
        getOrCreateDeviceId._sessionId = generateUuidV4();
    }
    return getOrCreateDeviceId._sessionId;
}

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
            ? '/api/simyo/sessions'
            : `${localBase}/api/simyo/sessions`,

        // eSIM相关
        getEsim: isNetlify
            ? '/api/simyo/esim/get-by-customer'
            : `${localBase}/api/simyo/esim/get-by-customer`,

        // 设备更换相关
        applyNewEsim: isNetlify
            ? '/api/simyo/settings/simcard'
            : `${localBase}/api/simyo/settings/simcard`,
        verifyCode: isNetlify
            ? '/api/simyo/esim/verify-code'
            : `${localBase}/api/simyo/esim/verify-code`,

        // 新增：查询可用的验证方式 (v2 API)
        availableValidationMethods: isNetlify
            ? '/api/simyo/esim.availableValidationMethods'
            : `${localBase}/api/simyo/esim.availableValidationMethods`,

        // 安装确认
        confirmInstall: isNetlify
            ? '/api/simyo/esim/reorder-profile-installed'
            : `${localBase}/api/simyo/esim/reorder-profile-installed`
    };
}

/**
 * 创建API请求头
 * @param {boolean} includeSession - 是否包含session token
 * @param {string} sessionToken - session token值
 */
export function createHeaders(includeSession = false, sessionToken = '') {
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client-Token': simyoConfig.clientToken,
        'X-Client-Platform': simyoConfig.clientPlatform,
        'X-Client-Version': simyoConfig.clientVersion,
        'X-Device-ID': getOrCreateDeviceId(),
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
