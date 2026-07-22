/**
 * Simyo API 配置模块
 * 定义端点、请求头与响应解析
 *
 * 请求头：X-Client-Token / Platform / Version / X-Device-ID / User-Agent
 * 版本与 UA 见 client-identity.js
 *
 * 登录：
 * POST /sessions
 *   - 未开 MFA（老用户常见 DISABLED_BY_CUSTOMER）→ sessionToken 可直接用
 *   - 已开 MFA（新用户默认 / 老用户开启后不可关）→ PENDING_VERIFICATION 后再
 *     POST /v2/security.verifyOTP 换正式 token
 * eSIM 更换主路径（仅 EMAIL）：
 * GET /settings/simcard → POST /settings/simcard
 * → POST /esim/verify-code → GET /esim/get-by-customer
 */

import { isNetlifyEnvironment } from './utils.js';
import { t } from '../../../js/modules/i18n.js';
import { simyoClientIdentity } from './client-identity.js';

/** localStorage 键：持久化设备 ID，模拟 iOS identifierForVendor */
const DEVICE_ID_STORAGE_KEY = 'simyo_device_id';

/**
 * Simyo 客户端配置（源自 client-identity）
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
 * API 端点配置（webapi 路径）
 */
export function getApiEndpoints() {
    const isNetlify = isNetlifyEnvironment();
    const isBrowserServed = typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
    const localBase = isBrowserServed ? '' : 'http://localhost:3000';

    return {
        login: isNetlify
            ? '/api/simyo/sessions'
            : `${localBase}/api/simyo/sessions`,

        // 登录 MFA：v2 security.verifyOTP（短信/邮箱共用同一接口）
        verifyOtp: isNetlify
            ? '/api/simyo/v2/security.verifyOTP'
            : `${localBase}/api/simyo/v2/security.verifyOTP`,

        // GET 查询 / POST 申请 共用 settings/simcard
        simcard: isNetlify
            ? '/api/simyo/settings/simcard'
            : `${localBase}/api/simyo/settings/simcard`,
        // 兼容旧命名
        applyNewEsim: isNetlify
            ? '/api/simyo/settings/simcard'
            : `${localBase}/api/simyo/settings/simcard`,

        verifyCode: isNetlify
            ? '/api/simyo/esim/verify-code'
            : `${localBase}/api/simyo/esim/verify-code`,

        getEsim: isNetlify
            ? '/api/simyo/esim/get-by-customer'
            : `${localBase}/api/simyo/esim/get-by-customer`,

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
 * @param {number} status
 * @param {object|string|null} data
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

    // 会话类（须先于笼统 unauthorized / credentials）
    if (
        normalized.includes('bad session') ||
        (normalized.includes('unauthoris') && normalized.includes('session')) ||
        (normalized.includes('unauthorized') && normalized.includes('session')) ||
        (normalized.includes('session') && (normalized.includes('expired') || normalized.includes('invalid')))
    ) {
        return t('simyo.api.error.badSession');
    }

    if (normalized.includes('missing x-device-id') || normalized.includes('x-device-id')) {
        return t('simyo.api.error.missingDeviceId');
    }
    if (
        normalized.includes('invalid credentials') ||
        normalized.includes('invalid password') ||
        normalized.includes('authentication failed') ||
        normalized.includes('wrong password')
    ) {
        return t('simyo.api.error.invalidCredentials');
    }
    if (normalized.includes('too many') || normalized.includes('rate limit') || normalized.includes('throttl')) {
        return t('simyo.api.error.rateLimited');
    }

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
        const friendly = t(statusMap[status]);
        if (raw && raw.length > 0 && raw.length <= 80 && !/^HTTP\s+\d+/i.test(raw)) {
            if (!friendly.includes(raw) && normalized !== friendly.toLowerCase()) {
                return `${friendly}（${raw}）`;
            }
        }
        return friendly;
    }

    if (raw) {
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
 * 判断 Simyo result 体是否表示业务成功
 * 登录/状态查询响应可能不含 result.success，而以 sessionToken、eSimStatus 等字段为准
 * @param {object} result
 * @returns {boolean}
 */
export function isSimyoResultSuccessful(result) {
    if (!result || typeof result !== 'object') {
        return false;
    }
    if (result.success === false) {
        return false;
    }
    if (result.success === true) {
        return true;
    }
    if (result.sessionToken) {
        return true;
    }
    // 登录 MFA：verifyOTP 返回正式会话 token
    if (result.token && typeof result.token === 'string' && result.token.length > 8) {
        return true;
    }
    if (result.activationCode) {
        return true;
    }
    if (result.eSimStatus || result.canCreateESim || result.canCreateSimcard) {
        return true;
    }
    if (result.reason != null || result.remainingNumberOfTries != null) {
        return true;
    }
    return false;
}

/**
 * 处理API响应
 * @param {Response} response
 */
export async function handleApiResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
        try {
            data = await response.json();
        } catch (e) {
            data = {};
        }
    } else {
        const text = await response.text();
        data = text ? { message: text } : {};
    }

    if (!response.ok) {
        throw new Error(mapSimyoErrorMessage(response.status, data));
    }

    if (!contentType.includes('application/json')) {
        return { success: true, result: data };
    }

    // 本地代理包装: { success, result, message }
    if (data.success === true && data.result) {
        return data;
    }

    // 直通 Simyo: { result: {...} }
    if (data.result) {
        if (data.result.success === false) {
            throw new Error(mapSimyoErrorMessage(0, data));
        }
        const ok = isSimyoResultSuccessful(data.result);
        return {
            success: ok,
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
