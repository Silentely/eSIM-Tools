/**
 * Simyo认证处理模块
 * 负责账户登录认证；识别 mfaStatus，未关闭 MFA 时阻断后续业务
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, createHeaders, handleApiResponse } from './api-config.js';
import { validatePhoneNumber } from './utils.js';
import { t } from '../../../js/modules/i18n.js';
import Logger from '../../../js/modules/logger.js';

/**
 * 判断登录返回的 mfaStatus 是否允许继续业务
 * DISABLED_BY_CUSTOMER 等表示无需再完成 MFA
 * @param {string} mfaStatus
 * @returns {boolean}
 */
export function isMfaDisabledOrComplete(mfaStatus) {
    if (mfaStatus == null || mfaStatus === '') {
        return true;
    }
    const s = String(mfaStatus).toUpperCase();
    return (
        s === 'DISABLED_BY_CUSTOMER' ||
        s === 'DISABLED' ||
        s === 'NONE' ||
        s === 'OFF' ||
        s === 'OK' ||
        s === 'VERIFIED' ||
        s === 'COMPLETED' ||
        s === 'NOT_REQUIRED'
    );
}

export class AuthHandler {
    constructor() {
        this.apiEndpoints = getApiEndpoints();
    }

    /**
     * 登录Simyo账户
     * @param {string} phoneNumber
     * @param {string} password
     * @returns {Promise<Object>}
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

            // 先落会话，便于诊断；MFA 未关闭则禁止进入设备更换
            stateManager.setState({
                sessionToken: sessionToken,
                phoneNumber: phoneNumber,
                mfaStatus: mfaStatus,
                mfaMethod: mfaMethod
            });

            if (!isMfaDisabledOrComplete(mfaStatus)) {
                const err = new Error(
                    t('simyo.auth.mfaRequired', {
                        status: mfaStatus,
                        method: mfaMethod || methodHint || '—'
                    })
                );
                err.code = 'MFA_REQUIRED';
                err.mfaStatus = mfaStatus;
                throw err;
            }

            return {
                success: true,
                message: t('simyo.auth.loginSuccess'),
                sessionToken: sessionToken,
                mfaStatus: mfaStatus
            };
        } catch (error) {
            Logger.error(t('simyo.auth.log.loginFailed'), error);
            throw error;
        }
    }

    isLoggedIn() {
        return !!stateManager.get('sessionToken');
    }

    getSessionToken() {
        return stateManager.get('sessionToken');
    }
}

export const authHandler = new AuthHandler();
