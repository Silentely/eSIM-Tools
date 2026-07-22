/**
 * Simyo 业务会话守卫
 * 统一校验：已登录 + 登录 MFA 已完成（非临时 token）
 */

import { stateManager } from './state-manager.js';
import { t } from '../../../js/modules/i18n.js';

/**
 * 读取可用于业务 API 的 session token
 * @returns {string}
 * @throws {Error} 未登录或登录 MFA 未完成
 */
export function requireSessionToken() {
    const sessionToken = stateManager.get('sessionToken');
    if (!sessionToken) {
        throw new Error(t('simyo.errors.requireLogin'));
    }
    // 临时登录 token 不可用于业务接口，须先完成 verifyOTP
    if (stateManager.get('mfaPending')) {
        throw new Error(t('simyo.errors.mfaIncomplete'));
    }
    return sessionToken;
}
