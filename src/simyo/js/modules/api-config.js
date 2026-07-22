/**
 * Simyo API配置模块
 * 定义所有API端点和请求配置
 *
 * 请求头字段对齐官方 Mijn Simyo iOS 抓包：
 * X-Client-Token / X-Client-Platform / X-Client-Version / X-Device-ID / User-Agent
 * 版本与 UA 见 client-identity.js（单一事实来源）
 */

import { isNetlifyEnvironment } from './utils.js';
import { t } from '../../../js/modules/i18n.js';
import { simyoClientIdentity } from './client-identity.js';

/** localStorage 键：持久化设备 ID，模拟 iOS identifierForVendor */
const DEVICE_ID_STORAGE_KEY = 'simyo_device_id';

/**
 * Simyo客户端配置（与官方 App 抓包一致，源自 client-identity）
 */
export const simyoConfig = {
    clientToken: simyoClientIdentity.clientToken,
    clientPlatform: simyoClientIdentity.clientPlatform,
    clientVersion: simyoClientIdentity.clientVersion,
    iosVersion: simyoClientIdentity.iosVersion,
    deviceModel: simyoClientIdentity.deviceModel,
    userAgent: simyoClientIdentity.userAgent
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
 * 将 Simyo / 代理返回的原始错误映射为用户可读文案
 * 优先匹配已知业务短语，其次按 HTTP 状态码，最后保留原文或通用失败
 *
 * @param {number} status - HTTP 状态码（业务体错误可传 0）
 * @param {object|string|null} data - 响应体或原始字符串
 * @returns {string}
 */
export function mapSimyoErrorMessage(status, data) {
    const rawParts = [];
    if (data && typeof data === 'object') {
        rawParts.push(data.message, data.error, data.reason, data.detail, data.title);
        if (data.result && typeof data.result === 'object') {
            rawParts.push(data.result.message, data.result.error, data.result.reason);
        }
    } else if (typeof data === 'string') {
        rawParts.push(data);
    }
    const raw = rawParts.filter((p) => p != null && String(p).trim() !== '').map(String).join(' ');
    const normalized = raw.toLowerCase();

    // 已知业务错误（Simyo 原文 / 代理透传）
    if (normalized.includes('missing x-device-id') || normalized.includes('x-device-id')) {
        return t('simyo.api.error.missingDeviceId');
    }
    if (
        normalized.includes('invalid credentials') ||
        normalized.includes('invalid password') ||
        normalized.includes('authentication failed') ||
        normalized.includes('unauthorized') ||
        normalized.includes('wrong password')
    ) {
        return t('simyo.api.error.invalidCredentials');
    }
    if (normalized.includes('session') && (normalized.includes('expired') || normalized.includes('invalid'))) {
        return t('simyo.api.error.sessionExpired');
    }
    if (normalized.includes('too many') || normalized.includes('rate limit') || normalized.includes('throttl')) {
        return t('simyo.api.error.rateLimited');
    }

    // HTTP 状态码语义（含历史上 426 客户端版本过旧）
    const statusMap = {
        400: 'simyo.api.error.badRequest',
        401: 'simyo.api.error.unauthorized',
        403: 'simyo.api.error.forbidden',
        404: 'simyo.api.error.notFound',
        408: 'simyo.api.error.timeout',
        426: 'simyo.api.error.upgradeRequired',
        429: 'simyo.api.error.rateLimited',
        500: 'simyo.api.error.server',
        502: 'simyo.api.error.badGateway',
        503: 'simyo.api.error.unavailable',
        504: 'simyo.api.error.timeout'
    };
    if (status && statusMap[status]) {
        // 有状态码映射时，优先友好文案；附带简短原文便于排查（过长则截断）
        const friendly = t(statusMap[status]);
        if (raw && raw.length > 0 && raw.length <= 80 && !/^HTTP\s+\d+/i.test(raw)) {
            // 避免重复拼接已是友好文案的情况
            if (!friendly.includes(raw) && normalized !== friendly.toLowerCase()) {
                return `${friendly}（${raw}）`;
            }
        }
        return friendly;
    }

    if (raw) {
        // 纯 HTTP NNN 形态的原文也换成通用失败
        if (/^HTTP\s+\d+$/i.test(raw.trim())) {
            return t('simyo.api.error.genericWithStatus', { status: raw.replace(/\D/g, '') || status || '?' });
        }
        return raw;
    }

    if (status) {
        return t('simyo.api.error.genericWithStatus', { status });
    }
    return t('simyo.api.error.generic');
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
        const text = await response.text();
        data = text ? { message: text } : {};
    }

    // HTTP 错误：映射为用户可读中文/英文，避免只显示「HTTP 426」
    if (!response.ok) {
        throw new Error(mapSimyoErrorMessage(response.status, data));
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
        // 业务失败（HTTP 200 但 success=false / 无 success 字段）也走友好文案
        if (nestedSuccess === false) {
            throw new Error(mapSimyoErrorMessage(0, data));
        }
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

    if (data.success === false) {
        throw new Error(mapSimyoErrorMessage(0, data));
    }

    throw new Error(mapSimyoErrorMessage(0, data) || t('simyo.api.error.generic'));
}
