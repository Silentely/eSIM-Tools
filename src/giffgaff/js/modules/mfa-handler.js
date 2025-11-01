/**
 * MFA验证处理模块
 * 负责多因素认证流程
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints } from './api-config.js';
import { t } from '../../../js/modules/i18n.js';

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
                throw new Error(t('giffgaff.mfa.errors.requestFailed', { status: response.status }));
            }
            
            const data = await response.json();
            
            // 检查令牌是否被刷新
            if (data._tokenRefreshed && data._newAccessToken) {
                console.log(t('giffgaff.mfa.log.tokenRefreshed'));
                stateManager.set('accessToken', data._newAccessToken);
            }
            
            if (data && data.ref) {
                stateManager.set('emailCodeRef', data.ref);
                return {
                    success: true,
                    ref: data.ref,
                    message: t('giffgaff.mfa.status.codeSent')
                };
            } else {
                throw new Error(t('giffgaff.mfa.errors.sendFailedRetry'));
            }
        } catch (error) {
            console.error(t('giffgaff.mfa.log.sendFailed'), error);
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
                throw new Error(t('giffgaff.mfa.errors.missingRef'));
            }
            
            if (!/^\d{6}$/.test(code)) {
                throw new Error(t('giffgaff.mfa.errors.invalidFormat'));
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
                throw new Error(t('giffgaff.mfa.errors.verifyFailed', {
                    status: response.status,
                    message: errorText
                }));
            }
            
            const data = await response.json();
            
            if (data.signature) {
                stateManager.set('emailSignature', data.signature);
                return {
                    success: true,
                    signature: data.signature,
                    message: t('giffgaff.mfa.status.codeVerified')
                };
            } else {
                throw new Error(t('giffgaff.mfa.errors.missingSignature'));
            }
        } catch (error) {
            console.error(t('giffgaff.mfa.log.verifyFailed'), error);
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
                throw new Error(t('giffgaff.mfa.errors.swapSendFailed', {
                    status: response.status,
                    message: errorText
                }));
            }
            
            const responseData = await response.json();
            console.log(t('giffgaff.mfa.log.swapResponse'), responseData);
            
            if (responseData.errors) {
                throw new Error(responseData.errors[0].message || t('giffgaff.mfa.errors.genericSendFailed'));
            }
            
            const data = responseData.data;
            if (!data || !data.simSwapMfaChallenge || !data.simSwapMfaChallenge.ref) {
                throw new Error(t('giffgaff.mfa.errors.invalidRef'));
            }
            
            stateManager.set('emailCodeRef', data.simSwapMfaChallenge.ref);
            
            return {
                success: true,
                ref: data.simSwapMfaChallenge.ref,
                message: t('giffgaff.mfa.status.codeSent')
            };
        } catch (error) {
            console.error(t('giffgaff.mfa.log.swapSendFailed'), error);
            throw error;
        }
    }
}

// 创建单例实例
export const mfaHandler = new MFAHandler();
