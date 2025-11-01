/**
 * Simyo eSIM服务模块
 * 负责eSIM相关的所有业务操作
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, createHeaders, handleApiResponse } from './api-config.js';
import { generateLPA } from './utils.js';

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
            throw new Error('请先登录账户');
        }
        
        try {
            const response = await fetch(this.apiEndpoints.getEsim, {
                method: 'GET',
                headers: createHeaders(true, sessionToken)
            });
            
            const data = await handleApiResponse(response);
            
            if (!data.success || !data.result || !data.result.activationCode) {
                throw new Error(data.message || '未找到有效的eSIM信息');
            }
            
            const activationCode = data.result.activationCode;
            
            // 保存激活码到状态
            stateManager.set('activationCode', activationCode);
            
            return {
                success: true,
                message: 'eSIM信息获取成功',
                data: {
                    activationCode: activationCode,
                    status: data.result.status,
                    phoneNumber: data.result.phoneNumber,
                    iccid: data.result.iccid
                }
            };
        } catch (error) {
            console.error('获取eSIM信息失败:', error);
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
            throw new Error('请先获取eSIM信息');
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
            throw new Error('请先登录账户');
        }
        
        try {
            const response = await fetch(this.apiEndpoints.confirmInstall, {
                method: 'POST',
                headers: createHeaders(true, sessionToken)
            });
            
            const data = await handleApiResponse(response);
            
            if (!data.success || !data.result) {
                throw new Error(data.message || '安装确认失败');
            }
            
            return {
                success: true,
                message: data.result.success 
                    ? 'eSIM安装确认成功！设备应该很快恢复信号' 
                    : (data.result.message || '安装确认完成，请检查设备eSIM状态')
            };
        } catch (error) {
            console.error('确认安装失败:', error);
            throw error;
        }
    }
}

// 创建单例实例
export const esimService = new EsimService();