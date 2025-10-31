/**
 * MFA验证处理模块
 * 负责多因素认证流程
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints } from './api-config.js';

export class MFAHandler {
    constructor() {
        this.apiEndpoints = getApiEndpoints();
    }
    
    /**
     * 发送MFA验证码
     */
    async sendMFAChallenge(channel = 'EMAIL') {
        try {
            const state = stateManager.getState();
            
            const response = await fetch(this.apiEndpoints.mfaChallenge, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': state.accessToken ? `Bearer ${state.accessToken}` : undefined
                },
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    cookie: stateManager.getCookie() || undefined,
                    source: "esim",
                    preferredChannels: channel === 'TEXT' ? ['TEXT'] : ['EMAIL']
                })
            });
            
            if (!response.ok) {
                throw new Error(`请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 检查令牌是否被刷新
            if (data._tokenRefreshed && data._newAccessToken) {
                console.log('令牌已刷新');
                stateManager.set('accessToken', data._newAccessToken);
            }
            
            if (data && data.ref) {
                stateManager.set('emailCodeRef', data.ref);
                return {
                    success: true,
                    ref: data.ref,
                    message: '验证码已发送'
                };
            } else {
                throw new Error('发送验证码未成功，请稍后重试');
            }
        } catch (error) {
            console.error('发送MFA验证码失败:', error);
            throw error;
        }
    }
    
    /**
     * 验证MFA验证码
     */
    async validateMFACode(code) {
        try {
            const state = stateManager.getState();
            const ref = state.emailCodeRef;
            
            if (!ref) {
                throw new Error('缺少验证码引用，请先发送验证码');
            }
            
            if (!/^\d{6}$/.test(code)) {
                throw new Error('验证码格式错误，请输入6位数字');
            }
            
            const response = await fetch(this.apiEndpoints.mfaValidation, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': state.accessToken ? `Bearer ${state.accessToken}` : undefined
                },
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    cookie: stateManager.getCookie() || undefined,
                    ref,
                    code
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`验证失败: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.signature) {
                stateManager.set('emailSignature', data.signature);
                return {
                    success: true,
                    signature: data.signature,
                    message: '验证码验证成功'
                };
            } else {
                throw new Error('未获取到签名');
            }
        } catch (error) {
            console.error('验证MFA验证码失败:', error);
            throw error;
        }
    }
    
    /**
     * 发送SIM交换MFA验证码
     */
    async sendSimSwapMFAChallenge() {
        try {
            const state = stateManager.getState();
            
            const response = await fetch(this.apiEndpoints.graphql, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': state.accessToken ? `Bearer ${state.accessToken}` : undefined
                },
                body: JSON.stringify([{
                    operationName: "simSwapMfaChallenge",
                    variables: {},
                    query: `mutation simSwapMfaChallenge {
                        simSwapMfaChallenge {
                            ref
                            methods {
                                value
                                channel
                                __typename
                            }
                            __typename
                        }
                    }`
                }])
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`发送失败: ${response.status} - ${errorText}`);
            }
            
            const responseData = await response.json();
            console.log('simSwapMfaChallenge 响应:', responseData);
            
            if (responseData.errors) {
                throw new Error(responseData.errors[0].message || '发送验证码失败');
            }
            
            const data = responseData.data;
            if (!data || !data.simSwapMfaChallenge || !data.simSwapMfaChallenge.ref) {
                throw new Error('未返回有效的验证码引用');
            }
            
            stateManager.set('emailCodeRef', data.simSwapMfaChallenge.ref);
            
            return {
                success: true,
                ref: data.simSwapMfaChallenge.ref,
                message: '验证码已发送'
            };
        } catch (error) {
            console.error('发送SIM交换验证码失败:', error);
            throw error;
        }
    }
}

// 创建单例实例
export const mfaHandler = new MFAHandler();