/**
 * Simyo设备更换处理模块
 * 负责设备更换的完整流程
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, createHeaders, handleApiResponse } from './api-config.js';
import { validateVerificationCode } from './utils.js';
import { t } from '../../../js/modules/i18n.js';

export class DeviceChangeHandler {
    constructor() {
        this.apiEndpoints = getApiEndpoints();
    }

    /**
     * 查询可用的验证方式
     * @returns {Promise<Object>} 可用的验证方式列表
     */
    async getAvailableValidationMethods() {
        const sessionToken = stateManager.get('sessionToken');

        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }

        try {
            const response = await fetch(this.apiEndpoints.availableValidationMethods, {
                method: 'POST',
                headers: createHeaders(true, sessionToken),
                body: JSON.stringify(null)
            });

            const data = await handleApiResponse(response);

            if (!data.success || !data.result) {
                throw new Error(data.message || t('simyo.device.queryFailed'));
            }

            return {
                success: true,
                methods: data.result.availableMethods || [],
                message: t('simyo.device.querySuccess')
            };
        } catch (error) {
            console.error(t('simyo.device.log.queryFailed'), error);
            throw error;
        }
    }

    /**
     * 申请新eSIM（支持邮箱验证）
     * @param {string} validationMethod - 验证方式 (默认: EMAIL)
     * @returns {Promise<Object>} 申请结果
     */
    async applyNewEsim(validationMethod = 'EMAIL') {
        const sessionToken = stateManager.get('sessionToken');

        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }

        try {
            const response = await fetch(this.apiEndpoints.applyNewEsim, {
                method: 'POST',
                headers: createHeaders(true, sessionToken),
                body: JSON.stringify({
                    initialValidationMethod: validationMethod,
                    esim: true
                })
            });

            const data = await handleApiResponse(response);

            if (!data.success || !data.result) {
                throw new Error(data.message || t('simyo.device.applyFailed'));
            }

            // 根据reason字段选择不同的提示消息
            let message = data.message || t('simyo.device.applySuccess');
            if (data.result.reason === 'AlreadyOrderedSimcardEsim') {
                message = t('simyo.device.applySuccessAlreadyOrdered');
            }

            return {
                success: true,
                message: message,
                remainingTries: data.result.remainingNumberOfTries
            };
        } catch (error) {
            console.error(t('simyo.device.log.applyFailed'), error);
            throw error;
        }
    }

    /**
     * 发送验证码（兼容新版邮箱验证与旧版短信验证）
     * @returns {Promise<Object>} 发送结果
     */
    async sendSmsCode() {
        const sessionToken = stateManager.get('sessionToken');

        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }

        let methodInfo = null;

        try {
            const methodResult = await this.getAvailableValidationMethods();
            methodInfo = this.detectValidationMethodSupport(methodResult.methods);
        } catch (_) {}

        // 回退旧版短信接口（兼容旧流程）
        if (!this.apiEndpoints.sendSmsCode) {
            throw new Error(t('simyo.device.smsFailed'));
        }

        try {
            const response = await fetch(this.apiEndpoints.sendSmsCode, {
                method: 'POST',
                headers: createHeaders(true, sessionToken),
            });

            const data = await handleApiResponse(response);

            if (!data.success || !data.result) {
                throw new Error(data.message || t('simyo.device.smsFailed'));
            }

            return {
                success: true,
                message: data.message || data.result.message || t('simyo.device.smsSuccess'),
                nextStep: data.result.nextStep,
            };
        } catch (error) {
            // 新版流程（邮箱验证）下，发送短信接口可能不存在，此时给出兼容提示
            if (methodInfo && methodInfo.hasEmail && !methodInfo.hasSms) {
                return {
                    success: true,
                    message: t('simyo.device.emailSent'),
                };
            }
            console.error(t('simyo.device.log.smsFailed'), error);
            throw error;
        }
    }

    /**
     * 解析可用验证方式
     * @param {Array} methods - 后端返回的验证方式列表
     * @returns {{hasEmail: boolean, hasSms: boolean}}
     */
    detectValidationMethodSupport(methods = []) {
        const normalizedMethods = (Array.isArray(methods) ? methods : [])
            .map((method) => {
                if (typeof method === 'string') return method;
                if (method && typeof method === 'object') {
                    return method.type || method.method || method.name || '';
                }
                return '';
            })
            .map(method => String(method).toUpperCase())
            .filter(Boolean);

        return {
            hasEmail: normalizedMethods.some(method => method.includes('EMAIL')),
            hasSms: normalizedMethods.some(method => method.includes('SMS')),
        };
    }

    /**
     * 验证验证码
     * @param {string} validationCode - 验证码
     * @returns {Promise<Object>} 验证结果
     */
    async verifyCode(validationCode) {
        const sessionToken = stateManager.get('sessionToken');

        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }

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

            if (!data.success) {
                throw new Error(data.message || t('simyo.device.verifyFailed'));
            }

            // 保存验证码到状态
            stateManager.set('validationCode', validationCode);

            return {
                success: true,
                message: data.message || t('simyo.device.verifySuccess'),
                remainingTries: data.result?.remainingNumberOfTries
            };
        } catch (error) {
            console.error(t('simyo.device.log.verifyFailed'), error);
            throw error;
        }
    }
}

// 创建单例实例
export const deviceChangeHandler = new DeviceChangeHandler();
