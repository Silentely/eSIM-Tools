/**
 * Simyo认证处理模块
 * 负责账户登录认证
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, createHeaders, handleApiResponse } from './api-config.js';
import { validatePhoneNumber } from './utils.js';

export class AuthHandler {
    constructor() {
        this.apiEndpoints = getApiEndpoints();
    }
    
    /**
     * 登录Simyo账户
     * @param {string} phoneNumber - 手机号
     * @param {string} password - 密码
     * @returns {Promise<Object>} 登录结果
     */
    async login(phoneNumber, password) {
        // 验证手机号格式
        if (!validatePhoneNumber(phoneNumber)) {
            throw new Error('请输入有效的荷兰手机号（06开头，10位数字）');
        }
        
        if (!password) {
            throw new Error('请输入密码');
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
            
            // 提取session token
            const sessionToken = data.result?.sessionToken;
            
            if (!sessionToken) {
                throw new Error(data.message || '登录失败，未获取到session token');
            }
            
            // 保存到状态
            stateManager.setState({
                sessionToken: sessionToken,
                phoneNumber: phoneNumber,
                password: password
            });
            
            return {
                success: true,
                message: '登录成功',
                sessionToken: sessionToken
            };
        } catch (error) {
            console.error('登录失败:', error);
            throw error;
        }
    }
    
    /**
     * 检查登录状态
     * @returns {boolean} 是否已登录
     */
    isLoggedIn() {
        return !!stateManager.get('sessionToken');
    }
    
    /**
     * 获取当前session token
     * @returns {string} session token
     */
    getSessionToken() {
        return stateManager.get('sessionToken');
    }
}

// 创建单例实例
export const authHandler = new AuthHandler();