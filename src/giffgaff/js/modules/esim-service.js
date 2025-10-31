/**
 * eSIM服务模块
 * 负责eSIM相关的所有操作
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, graphqlQueries } from './api-config.js';

export class ESimService {
    constructor() {
        this.apiEndpoints = getApiEndpoints();
    }
    
    /**
     * 获取会员信息
     */
    async getMemberInfo() {
        try {
            const state = stateManager.getState();
            
            if (!state.accessToken) {
                throw new Error("缺少访问令牌，请重新进行OAuth认证");
            }
            
            if (!state.emailSignature) {
                throw new Error("缺少邮件验证签名，请完成邮件验证");
            }
            
            const response = await fetch(this.apiEndpoints.graphql, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    mfaSignature: state.emailSignature,
                    query: graphqlQueries.getMemberProfile,
                    operationName: 'getMemberProfileAndSim'
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`请求失败: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.errors) {
                throw new Error(data.errors[0].message);
            }
            
            // 保存会员信息
            stateManager.setState({
                memberId: data.data.memberProfile.id,
                memberName: data.data.memberProfile.memberName,
                phoneNumber: data.data.sim.phoneNumber
            });
            
            return {
                success: true,
                data: data.data,
                message: '会员信息获取成功'
            };
        } catch (error) {
            console.error('获取会员信息失败:', error);
            throw error;
        }
    }
    
    /**
     * 预订eSIM
     */
    async reserveESim() {
        try {
            const state = stateManager.getState();
            
            const response = await fetch(this.apiEndpoints.graphql, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    mfaSignature: state.emailSignature,
                    query: graphqlQueries.reserveESim,
                    variables: {
                        input: {
                            memberId: state.memberId,
                            userIntent: "SWITCH"
                        }
                    },
                    operationName: 'reserveESim'
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`请求失败: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.errors) {
                throw new Error(data.errors[0].message);
            }
            
            // 保存eSIM信息
            stateManager.setState({
                esimSSN: data.data.reserveESim.esim.ssn,
                esimActivationCode: data.data.reserveESim.esim.activationCode,
                esimDeliveryStatus: data.data.reserveESim.esim.deliveryStatus
            });
            
            return {
                success: true,
                data: data.data.reserveESim,
                message: 'eSIM预订成功'
            };
        } catch (error) {
            console.error('预订eSIM失败:', error);
            throw error;
        }
    }
    
    /**
     * 交换SIM卡
     */
    async swapSim(activationCode, mfaSignature, mfaRef) {
        try {
            const state = stateManager.getState();
            
            const response = await fetch(this.apiEndpoints.graphql, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.accessToken}`,
                    'X-MFA-Signature': mfaSignature,
                    'X-CF-Turnstile': window.__cfTurnstileToken || ''
                },
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    mfaSignature: mfaSignature,
                    turnstileToken: window.__cfTurnstileToken || '',
                    operationName: "SwapSim",
                    variables: {
                        activationCode,
                        mfaSignature,
                        mfaRef
                    },
                    query: graphqlQueries.swapSim
                })
            });
            
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`SIM交换失败: ${response.status} - ${errText}`);
            }
            
            const swapData = await response.json();
            
            if (swapData.errors) {
                throw new Error(swapData.errors[0]?.message || 'SIM交换失败');
            }
            
            const newSim = swapData?.data?.swapSim?.new;
            if (!newSim || !newSim.ssn) {
                throw new Error('SIM交换响应异常，未找到新SIM信息');
            }
            
            // 更新状态
            stateManager.setState({
                esimSSN: newSim.ssn,
                esimActivationCode: newSim.activationCode || state.esimActivationCode,
                esimDeliveryStatus: 'ACTIVE'
            });
            
            return {
                success: true,
                data: swapData.data.swapSim,
                message: 'SIM交换成功'
            };
        } catch (error) {
            console.error('SIM交换失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取eSIM下载Token
     */
    async getESimDownloadToken(ssn) {
        try {
            const state = stateManager.getState();
            
            const response = await fetch(this.apiEndpoints.graphql, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    mfaSignature: state.emailSignature,
                    query: graphqlQueries.eSimDownloadToken,
                    variables: { ssn },
                    operationName: 'eSimDownloadToken'
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`请求失败: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.errors) {
                throw new Error(data.errors[0].message);
            }
            
            const lpaString = data.data.eSimDownloadToken.lpaString;
            stateManager.set('lpaString', lpaString);
            
            return {
                success: true,
                lpaString,
                data: data.data.eSimDownloadToken,
                message: 'eSIM下载代码获取成功'
            };
        } catch (error) {
            console.error('获取eSIM下载Token失败:', error);
            throw error;
        }
    }
    
    /**
     * 自动激活eSIM（通过网页）
     */
    async autoActivateESim(activationCode) {
        try {
            const webCookie = stateManager.getCookie();
            if (!webCookie) {
                throw new Error('需要 giffgaff 官网 Cookie 才能自动激活');
            }
            
            const state = stateManager.getState();
            
            const response = await fetch(this.apiEndpoints.autoActivate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activationCode,
                    cookie: webCookie,
                    accessToken: state.accessToken || undefined
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`激活请求失败: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // 更新eSIM状态
                stateManager.set('esimDeliveryStatus', 'ACTIVE');
                
                return {
                    success: true,
                    needsManualConfirm: result.message.includes('可能需要手动确认'),
                    message: result.message
                };
            } else {
                throw new Error(result.message || '激活失败');
            }
        } catch (error) {
            console.error('自动激活eSIM失败:', error);
            throw error;
        }
    }
    
    /**
     * 完整的短信激活流程
     */
    async smsActivateFlow(smsCode) {
        try {
            const state = stateManager.getState();
            
            // 1. 验证短信验证码
            const mfaResult = await this.validateMFACodeForSwap(smsCode);
            
            // 2. 预订eSIM
            const reserveResult = await this.reserveESim();
            
            // 3. 执行SIM交换
            const swapResult = await this.swapSim(
                reserveResult.data.esim.activationCode,
                mfaResult.signature,
                state.emailCodeRef
            );
            
            // 4. 获取LPA（轮询）
            await this.waitAndGetLPA(swapResult.data.new.ssn);
            
            return {
                success: true,
                message: '短信激活流程完成'
            };
        } catch (error) {
            console.error('短信激活流程失败:', error);
            throw error;
        }
    }
    
    /**
     * 等待并获取LPA
     */
    async waitAndGetLPA(ssn, maxRetries = 10) {
        // 等待系统处理
        await new Promise(r => setTimeout(r, 5000));
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const result = await this.getESimDownloadToken(ssn);
                if (result.lpaString) {
                    return result;
                }
            } catch (error) {
                console.warn(`获取LPA尝试 ${i + 1}/${maxRetries} 失败:`, error);
            }
            await new Promise(r => setTimeout(r, 4000));
        }
        
        throw new Error('获取LPA超时，请稍后在第五步手动获取');
    }
    
    /**
     * 为SIM交换验证MFA验证码
     */
    async validateMFACodeForSwap(code) {
        const state = stateManager.getState();
        
        const response = await fetch(this.apiEndpoints.mfaValidation, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': state.accessToken ? `Bearer ${state.accessToken}` : undefined,
                'X-CF-Turnstile': window.__cfTurnstileToken || ''
            },
            body: JSON.stringify({
                accessToken: state.accessToken,
                cookie: stateManager.getCookie() || undefined,
                ref: state.emailCodeRef,
                code,
                turnstileToken: window.__cfTurnstileToken || ''
            })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`验证失败: ${response.status} - ${errText}`);
        }
        
        const data = await response.json();
        const signature = data.signature || '';
        stateManager.set('emailSignature', signature);
        
        return { success: true, signature };
    }
}

// 创建单例实例
export const esimService = new ESimService();