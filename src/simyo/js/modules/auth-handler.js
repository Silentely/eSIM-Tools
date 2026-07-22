/**
 * Simyo 认证处理模块
 * 登录 + 可选登录 MFA（短信/邮箱共用 verifyOTP）
 *
 * 账号策略（与官方一致，本工具只跟随后端 mfaStatus）：
 * - 老用户：默认未开 MFA（常见 mfaStatus=DISABLED_BY_CUSTOMER / 空）→ 登录即正式会话，跳过步骤 2
 * - 新用户：默认开启 MFA；老用户也可自行开启，开启后不可关闭
 *   → mfaStatus=PENDING_VERIFICATION 等 → 临时会话 + 步骤 2 verifyOTP → 正式会话
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, createHeaders, handleApiResponse } from './api-config.js';
import { validatePhoneNumber } from './utils.js';
import { t } from '../../../js/modules/i18n.js';
import Logger from '../../../js/modules/logger.js';

/** 无需 / 已完成登录 MFA 的状态（精确匹配，避免 NOT_REQUIRED 被 includes 误伤） */
const MFA_SKIP_STATUSES = new Set([
    'DISABLED_BY_CUSTOMER',
    'DISABLED',
    'NONE',
    'OFF',
    'OK',
    'VERIFIED',
    'COMPLETED',
    'NOT_REQUIRED',
    'INACTIVE',
    'DISABLED_BY_OPERATOR'
]);

/** 登录后必须提交 OTP 的状态 */
const MFA_PENDING_STATUSES = new Set([
    'PENDING_VERIFICATION',
    'PENDING',
    'REQUIRED',
    'CHALLENGE_REQUIRED',
    'ENABLED',
    'ACTIVE'
]);

/**
 * MFA 未开启、已关闭，或本会话已验证完成 — 登录后可直接使用 sessionToken
 * @param {string} mfaStatus
 * @returns {boolean}
 */
export function isMfaDisabledOrComplete(mfaStatus) {
    if (mfaStatus == null || mfaStatus === '') {
        return true;
    }
    return MFA_SKIP_STATUSES.has(String(mfaStatus).toUpperCase().trim());
}

/**
 * 登录后需要提交 OTP 才能得到正式会话（新用户默认 / 老用户已开启 MFA）
 * @param {string} mfaStatus
 * @returns {boolean}
 */
export function isMfaPending(mfaStatus) {
    if (mfaStatus == null || mfaStatus === '') {
        return false;
    }
    const s = String(mfaStatus).toUpperCase().trim();
    // 先排除明确「无需 MFA」：NOT_REQUIRED 等不能被 REQUIRED 子串误判
    if (MFA_SKIP_STATUSES.has(s)) {
        return false;
    }
    if (MFA_PENDING_STATUSES.has(s)) {
        return true;
    }
    // 未知枚举：仅当语义明确为待验证时进入 MFA（避免老接口变体被挡死）
    if (s.includes('PENDING') || s.includes('CHALLENGE')) {
        return true;
    }
    // 含 REQUIRED 但排除 NOT_REQUIRED（已在 SKIP 集合）
    if (s.includes('REQUIRED') && !s.includes('NOT_REQUIRED')) {
        return true;
    }
    return false;
}

export class AuthHandler {
    constructor() {
        this.apiEndpoints = getApiEndpoints();
    }

    /**
     * 登录 Simyo 账户
     * @param {string} phoneNumber
     * @param {string} password
     * @returns {Promise<{success:boolean, needsMfa?:boolean, sessionToken?:string, mfaStatus?:string, mfaMethod?:string, methodHint?:string, message?:string}>}
     */
    async login(phoneNumber, password) {
        if (!validatePhoneNumber(phoneNumber)) {
            throw new Error(t('simyo.errors.invalidPhone'));
        }

        if (!password) {
            throw new Error(t('simyo.errors.requirePassword'));
        }

        try {
            const response = await fetch(this.apiEndpoints.login, {
                method: 'POST',
                headers: createHeaders(false),
                body: JSON.stringify({
                    phoneNumber: phoneNumber,
                    password: password
                })
            });

            const data = await handleApiResponse(response);
            const result = data.result || {};
            const sessionToken = result.sessionToken;

            if (!sessionToken) {
                throw new Error(data.message || t('simyo.auth.loginMissingToken'));
            }

            const mfaStatus = result.mfaStatus || '';
            const mfaMethod = result.mfaMethod || '';
            const methodHint = result.methodHint || '';

            // 分支 A：账号已开 MFA（新用户默认 / 老用户曾开启）→ 临时 token + 步骤 2
            if (isMfaPending(mfaStatus)) {
                Logger.log('[Simyo Auth] 登录需 MFA:', mfaStatus, mfaMethod || '');
                stateManager.setState({
                    sessionToken: sessionToken,
                    phoneNumber: phoneNumber,
                    mfaStatus: mfaStatus,
                    mfaMethod: mfaMethod,
                    methodHint: methodHint,
                    mfaPending: true
                });

                return {
                    success: true,
                    needsMfa: true,
                    sessionToken: sessionToken,
                    mfaStatus: mfaStatus,
                    mfaMethod: mfaMethod,
                    methodHint: methodHint,
                    message: t('simyo.auth.mfaCodeSent', {
                        hint: methodHint || mfaMethod || '—'
                    })
                };
            }

            // 分支 B：未开 MFA 的老用户（或已验证完成）→ 登录响应中的 sessionToken 即为正式会话
            // 常见：DISABLED_BY_CUSTOMER、空状态；不强制进入步骤 2
            const resolvedStatus = mfaStatus || 'DISABLED_BY_CUSTOMER';
            Logger.log('[Simyo Auth] 登录无需 MFA:', resolvedStatus);
            stateManager.setState({
                sessionToken: sessionToken,
                phoneNumber: phoneNumber,
                mfaStatus: resolvedStatus,
                mfaMethod: mfaMethod,
                methodHint: methodHint,
                mfaPending: false
            });

            return {
                success: true,
                needsMfa: false,
                message: t('simyo.auth.loginSuccess'),
                sessionToken: sessionToken,
                mfaStatus: resolvedStatus
            };
        } catch (error) {
            Logger.error(t('simyo.auth.log.loginFailed'), error);
            throw error;
        }
    }

    /**
     * 校验登录 MFA 验证码（短信/邮箱同一接口）
     * POST /webapi/api/v2/security.verifyOTP
     * @param {string} otpCode
     * @returns {Promise<Object>}
     */
    async verifyLoginOtp(otpCode) {
        const sessionToken = stateManager.get('sessionToken');
        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }

        const code = String(otpCode || '').trim();
        if (!/^\d{6}$/.test(code)) {
            throw new Error(t('simyo.errors.invalidCodeFormat'));
        }

        try {
            const response = await fetch(this.apiEndpoints.verifyOtp, {
                method: 'POST',
                headers: createHeaders(true, sessionToken),
                body: JSON.stringify({
                    rememberMe: true,
                    token: code
                })
            });

            const data = await handleApiResponse(response);
            const result = data.result || {};
            // 正式会话 token 在 result.token
            const formalToken = result.token || result.sessionToken;

            if (!formalToken) {
                throw new Error(data.message || t('simyo.auth.mfaMissingToken'));
            }

            stateManager.setState({
                sessionToken: formalToken,
                mfaPending: false,
                mfaStatus: 'VERIFIED'
            });

            return {
                success: true,
                sessionToken: formalToken,
                message: t('simyo.auth.mfaVerified')
            };
        } catch (error) {
            Logger.error(t('simyo.auth.log.mfaVerifyFailed'), error);
            throw error;
        }
    }

    /**
     * 是否已具备可业务使用的会话（已登录且不在 MFA 待验证）
     */
    isLoggedIn() {
        return !!stateManager.get('sessionToken') && !stateManager.get('mfaPending');
    }

    getSessionToken() {
        return stateManager.get('sessionToken');
    }
}

export const authHandler = new AuthHandler();
