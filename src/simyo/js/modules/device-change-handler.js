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
     * 申请新eSIM
     * @returns {Promise<Object>} 申请结果
     */
    async applyNewEsim() {
        const sessionToken = stateManager.get('sessionToken');
        
        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }
        
        try {
            const response = await fetch(this.apiEndpoints.applyNewEsim, {
                method: 'POST',
                headers: createHeaders(true, sessionToken)
            });
            
            const data = await handleApiResponse(response);
            
            if (!data.success || !data.result) {
                throw new Error(data.message || t('simyo.device.applyFailed'));
            }
            
            return {
                success: true,
                message: data.result.message || t('simyo.device.applySuccess'),
                nextStep: data.result.nextStep
            };
        } catch (error) {
            console.error(t('simyo.device.log.applyFailed'), error);
            throw error;
        }
    }
    
    /**
     * 发送短信验证码
     * @returns {Promise<Object>} 发送结果
     */
    async sendSmsCode() {
        const sessionToken = stateManager.get('sessionToken');
        
        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }
        
        try {
            const response = await fetch(this.apiEndpoints.sendSmsCode, {
                method: 'POST',
                headers: createHeaders(true, sessionToken)
            });
            
            const data = await handleApiResponse(response);
            
            if (!data.success || !data.result) {
                throw new Error(data.message || t('simyo.device.smsFailed'));
            }
            
            return {
                success: true,
                message: data.result.message || t('simyo.device.smsSuccess'),
                nextStep: data.result.nextStep
            };
        } catch (error) {
            console.error(t('simyo.device.log.smsFailed'), error);
            throw error;
        }
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
            
            if (!data.success || !data.result) {
                throw new Error(data.message || t('simyo.device.verifyFailed'));
            }
            
            // 保存验证码到状态
            stateManager.set('validationCode', validationCode);
            
            return {
                success: true,
                message: data.result.message || t('simyo.device.verifySuccess'),
                nextStep: data.result.nextStep
            };
        } catch (error) {
            console.error(t('simyo.device.log.verifyFailed'), error);
            throw error;
        }
    }
}

// 创建单例实例
export const deviceChangeHandler = new DeviceChangeHandler();
