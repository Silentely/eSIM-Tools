/**
 * Simyo认证处理模块
 * 负责账户登录认证
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, createHeaders, handleApiResponse } from './api-config.js';
import { validatePhoneNumber } from './utils.js';
import { t } from '../../../js/modules/i18n.js';
import Logger from '../../../js/modules/logger.js';

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

            // 提取session token
            const sessionToken = data.result && data.result.sessionToken;

            if (!sessionToken) {
                throw new Error(data.message || t('simyo.auth.loginMissingToken'));
            }

            // 仅保存会话令牌与手机号；密码不落内存状态，降低调试/快照泄露面
            stateManager.setState({
                sessionToken: sessionToken,
                phoneNumber: phoneNumber,
                password: ''
            });

            return {
                success: true,
                message: t('simyo.auth.loginSuccess'),
                sessionToken: sessionToken
            };
        } catch (error) {
            Logger.error(t('simyo.auth.log.loginFailed'), error);
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
