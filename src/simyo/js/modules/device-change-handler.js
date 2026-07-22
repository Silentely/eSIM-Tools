/**
 * Simyo设备更换处理模块
 * 对齐官方 App HAR（仅 EMAIL 验证）：
 * GET settings/simcard → POST settings/simcard(EMAIL) → POST esim/verify-code
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, createHeaders, handleApiResponse } from './api-config.js';
import { validateVerificationCode } from './utils.js';
import { t } from '../../../js/modules/i18n.js';
import Logger from '../../../js/modules/logger.js';

/** 官方 eSimStatus 状态 */
export const ESIM_STATUS = {
    START_REQUEST: 'ESIM_START_REQUEST',
    WAITING_FOR_VALIDATION_CODE: 'ESIM_REQUEST_WAITING_FOR_VALIDATION_CODE',
    READY_FOR_DOWNLOAD: 'ESIM_REQUEST_READY_FOR_DOWNLOAD'
};

export class DeviceChangeHandler {
    constructor() {
        this.apiEndpoints = getApiEndpoints();
    }

    /**
     * 读取当前 session token，未登录则抛错
     * @returns {string}
     */
    requireSessionToken() {
        const sessionToken = stateManager.get('sessionToken');
        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }
        return sessionToken;
    }

    /**
     * GET /settings/simcard — 查询 eSIM 订单状态
     * @returns {Promise<Object>}
     */
    async getSimcardStatus() {
        const sessionToken = this.requireSessionToken();
        const response = await fetch(this.apiEndpoints.simcard, {
            method: 'GET',
            headers: createHeaders(true, sessionToken)
        });
        const data = await handleApiResponse(response);
        if (!data.result) {
            throw new Error(data.message || t('simyo.device.statusFailed'));
        }
        return data.result;
    }

    /**
     * 请求设备更换（固定 EMAIL，对齐官方 body）
     * 会先 GET 状态：已在等待验证码 / 可下载时避免重复下单
     * @returns {Promise<Object>}
     */
    async applyNewEsim() {
        const sessionToken = this.requireSessionToken();

        try {
            // 1) 查询当前状态
            let status = null;
            try {
                status = await this.getSimcardStatus();
            } catch (statusError) {
                Logger.warn(t('simyo.device.log.statusFailed'), statusError);
                // 查询失败仍尝试 POST，兼容旧代理
            }

            if (status) {
                if (status.eSimStatus === ESIM_STATUS.WAITING_FOR_VALIDATION_CODE) {
                    return {
                        success: true,
                        message: t('simyo.device.applySuccessAlreadyOrdered'),
                        remainingTries: status.remainingNumberOfTries,
                        eSimStatus: status.eSimStatus,
                        reason: status.canCreateESim || 'AlreadyOrderedSimcardEsim',
                        alreadyPending: true
                    };
                }
                if (status.eSimStatus === ESIM_STATUS.READY_FOR_DOWNLOAD) {
                    return {
                        success: true,
                        message: t('simyo.device.readyForDownload'),
                        remainingTries: status.remainingNumberOfTries,
                        eSimStatus: status.eSimStatus,
                        readyForDownload: true
                    };
                }
            }

            // 2) POST 申请（仅 EMAIL）
            const response = await fetch(this.apiEndpoints.applyNewEsim, {
                method: 'POST',
                headers: createHeaders(true, sessionToken),
                body: JSON.stringify({
                    initialValidationMethod: 'EMAIL',
                    esim: true
                })
            });

            const data = await handleApiResponse(response);

            if (!data.result) {
                throw new Error(data.message || t('simyo.device.applyFailed'));
            }

            // 官方：success:true + reason Available | AlreadyOrderedSimcardEsim
            if (data.result.success === false) {
                throw new Error(data.message || data.result.reason || t('simyo.device.applyFailed'));
            }

            let message = t('simyo.device.applySuccess');
            if (data.result.reason === 'AlreadyOrderedSimcardEsim') {
                message = t('simyo.device.applySuccessAlreadyOrdered');
            }

            return {
                success: true,
                message: message,
                remainingTries: data.result.remainingNumberOfTries,
                reason: data.result.reason,
                eSimStatus: ESIM_STATUS.WAITING_FOR_VALIDATION_CODE
            };
        } catch (error) {
            Logger.error(t('simyo.device.log.applyFailed'), error);
            throw error;
        }
    }

    /**
     * 验证邮箱验证码 POST /esim/verify-code
     * @param {string} validationCode
     * @returns {Promise<Object>}
     */
    async verifyCode(validationCode) {
        const sessionToken = this.requireSessionToken();

        if (!validateVerificationCode(validationCode)) {
            throw new Error(t('simyo.errors.invalidCodeFormat'));
        }

        try {
            const response = await fetch(this.apiEndpoints.verifyCode, {
                method: 'POST',
                headers: createHeaders(true, sessionToken),
                body: JSON.stringify({
                    validationCode: validationCode
                })
            });

            const data = await handleApiResponse(response);

            if (!data.result || data.result.success === false) {
                throw new Error(data.message || t('simyo.device.verifyFailed'));
            }

            stateManager.set('validationCode', validationCode);

            return {
                success: true,
                message: data.message || t('simyo.device.verifySuccess'),
                remainingTries: data.result.remainingNumberOfTries,
                eSimStatus: ESIM_STATUS.READY_FOR_DOWNLOAD
            };
        } catch (error) {
            Logger.error(t('simyo.device.log.verifyFailed'), error);
            throw error;
        }
    }
}

export const deviceChangeHandler = new DeviceChangeHandler();
