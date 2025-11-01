/**
 * Simyo设备更换处理模块
 * 负责设备更换的完整流程
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, createHeaders, handleApiResponse } from './api-config.js';
import { validateVerificationCode } from './utils.js';

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
            throw new Error('请先登录账户');
        }
        
        try {
            const response = await fetch(this.apiEndpoints.applyNewEsim, {
                method: 'POST',
                headers: createHeaders(true, sessionToken)
            });
            
            const data = await handleApiResponse(response);
            
            if (!data.success || !data.result) {
                throw new Error(data.message || '申请新eSIM失败');
            }
            
            return {
                success: true,
                message: data.result.message || '新eSIM申请成功',
                nextStep: data.result.nextStep
            };
        } catch (error) {
            console.error('申请新eSIM失败:', error);
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
            throw new Error('请先登录账户');
        }
        
        try {
            const response = await fetch(this.apiEndpoints.sendSmsCode, {
                method: 'POST',
                headers: createHeaders(true, sessionToken)
            });
            
            const data = await handleApiResponse(response);
            
            if (!data.success || !data.result) {
                throw new Error(data.message || '发送验证码失败');
            }
            
            return {
                success: true,
                message: data.result.message || '验证码已发送',
                nextStep: data.result.nextStep
            };
        } catch (error) {
            console.error('发送验证码失败:', error);
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
            throw new Error('请先登录账户');
        }
        
        if (!validateVerificationCode(validationCode)) {
            throw new Error('请输入6位数字验证码');
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
                throw new Error(data.message || '验证码验证失败');
            }
            
            // 保存验证码到状态
            stateManager.set('validationCode', validationCode);
            
            return {
                success: true,
                message: data.result.message || '验证码验证成功',
                nextStep: data.result.nextStep
            };
        } catch (error) {
            console.error('验证码验证失败:', error);
            throw error;
        }
    }
}

// 创建单例实例
export const deviceChangeHandler = new DeviceChangeHandler();