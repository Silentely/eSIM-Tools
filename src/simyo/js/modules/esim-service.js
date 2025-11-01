/**
 * Simyo eSIM服务模块
 * 负责eSIM相关的所有业务操作
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, createHeaders, handleApiResponse } from './api-config.js';
import { generateLPA } from './utils.js';
import { t } from '../../../js/modules/i18n.js';

export class EsimService {
    constructor() {
        this.apiEndpoints = getApiEndpoints();
    }
    
    /**
     * 获取eSIM信息
     * @returns {Promise<Object>} eSIM信息
     */
    async getEsim() {
        const sessionToken = stateManager.get('sessionToken');
        
        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }
        
        try {
            const response = await fetch(this.apiEndpoints.getEsim, {
                method: 'GET',
                headers: createHeaders(true, sessionToken)
            });
            
            const data = await handleApiResponse(response);
            
            if (!data.success || !data.result || !data.result.activationCode) {
                throw new Error(data.message || t('simyo.esim.errors.notFound'));
            }
            
            const activationCode = data.result.activationCode;
            
            // 保存激活码到状态
            stateManager.set('activationCode', activationCode);
            
            return {
                success: true,
                message: t('simyo.esim.status.fetchSuccess'),
                data: {
                    activationCode: activationCode,
                    status: data.result.status,
                    phoneNumber: data.result.phoneNumber,
                    iccid: data.result.iccid
                }
            };
        } catch (error) {
            console.error(t('simyo.esim.log.fetchFailed'), error);
            throw error;
        }
    }
    
    /**
     * 生成LPA字符串和二维码
     * @returns {Object} LPA信息
     */
    generateLPAString() {
        const activationCode = stateManager.get('activationCode');
        
        if (!activationCode) {
            throw new Error(t('simyo.esim.errors.requireActivation'));
        }
        
        const lpaString = generateLPA(activationCode);
        
        return {
            success: true,
            lpaString: lpaString,
            activationCode: activationCode
        };
    }
    
    /**
     * 确认eSIM安装
     * @returns {Promise<Object>} 确认结果
     */
    async confirmInstall() {
        const sessionToken = stateManager.get('sessionToken');
        
        if (!sessionToken) {
            throw new Error(t('simyo.errors.requireLogin'));
        }
        
        try {
            const response = await fetch(this.apiEndpoints.confirmInstall, {
                method: 'POST',
                headers: createHeaders(true, sessionToken)
            });
            
            const data = await handleApiResponse(response);
            
            if (!data.success || !data.result) {
                throw new Error(data.message || t('simyo.esim.errors.confirmFailed'));
            }
            
            return {
                success: true,
                message: data.result.success 
                    ? t('simyo.esim.status.confirmSuccess')
                    : (data.result.message || t('simyo.esim.status.confirmFallback'))
            };
        } catch (error) {
            console.error(t('simyo.esim.log.confirmFailed'), error);
            throw error;
        }
    }
}

// 创建单例实例
export const esimService = new EsimService();
