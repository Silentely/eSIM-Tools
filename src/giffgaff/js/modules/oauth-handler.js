/**
 * OAuth处理模块
 * 负责OAuth 2.0 PKCE认证流程
 */

import { stateManager } from './state-manager.js';
import { generateCodeVerifier, generateCodeChallenge, generateState } from './utils.js';
import { oauthConfig } from './api-config.js';

export class OAuthHandler {
    /**
     * 开始OAuth登录流程
     */
    async startOAuthLogin() {
        try {
            // 生成PKCE参数
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            const state = generateState();
            
            // 保存code verifier
            stateManager.set('codeVerifier', codeVerifier);
            
            // 临时持久化到sessionStorage
            try {
                const pkceMap = JSON.parse(sessionStorage.getItem('gg_pkce_map') || '{}');
                pkceMap[state] = codeVerifier;
                sessionStorage.setItem('gg_pkce_map', JSON.stringify(pkceMap));
                sessionStorage.setItem('gg_oauth_last_state', state);
            } catch (e) {
                console.error('保存PKCE参数失败:', e);
            }
            
            // 构建授权URL
            const authParams = new URLSearchParams({
                response_type: 'code',
                client_id: oauthConfig.clientId,
                redirect_uri: oauthConfig.redirectUri,
                scope: oauthConfig.scope,
                state: state,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256'
            });
            
            const authUrl = `${oauthConfig.authUrl}?${authParams.toString()}`;
            
            // 打开登录页面
            window.open(authUrl, '_blank');
            
            return {
                success: true,
                message: '登录页面已打开，请完成登录后复制回调URL'
            };
        } catch (error) {
            console.error('OAuth登录准备失败:', error);
            throw error;
        }
    }
    
    /**
     * 处理OAuth回调
     */
    async processCallback(callbackUrl) {
        try {
            // 解析回调URL
            let code, state;
            
            if (callbackUrl.startsWith('giffgaff://')) {
                const match = callbackUrl.match(/[?&]code=([^&]+)/);
                const stateMatch = callbackUrl.match(/[?&]state=([^&]+)/);
                code = match ? decodeURIComponent(match[1]) : null;
                state = stateMatch ? decodeURIComponent(stateMatch[1]) : null;
            } else {
                const url = new URL(callbackUrl);
                code = url.searchParams.get('code');
                state = url.searchParams.get('state');
            }
            
            if (!code) {
                throw new Error("回调URL中未找到授权码");
            }
            
            console.log('解析到的授权码:', code);
            console.log('解析到的状态:', state);
            
            // 恢复code verifier
            let codeVerifier = stateManager.get('codeVerifier');
            if (!codeVerifier) {
                try {
                    const pkceMap = JSON.parse(sessionStorage.getItem('gg_pkce_map') || '{}');
                    const byState = state && pkceMap[state];
                    if (byState && byState.length >= 43) {
                        codeVerifier = byState;
                    }
                    if (!codeVerifier) {
                        const savedVerifier = sessionStorage.getItem('gg_code_verifier');
                        if (savedVerifier && savedVerifier.length >= 43) {
                            codeVerifier = savedVerifier;
                        }
                    }
                } catch (e) {
                    console.error('恢复code verifier失败:', e);
                }
            }
            
            if (!codeVerifier) {
                throw new Error('会话已重置或过期：缺少 code_verifier，请重新点击"开始OAuth登录"');
            }
            
            // 交换访问令牌
            const tokenResponse = await fetch(oauthConfig.tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    code_verifier: codeVerifier,
                    redirect_uri: oauthConfig.redirectUri,
                    client_id: oauthConfig.clientId
                })
            });
            
            if (!tokenResponse.ok) {
                throw new Error(`Token交换失败: ${tokenResponse.status}`);
            }
            
            const tokenData = await tokenResponse.json();
            
            // 保存访问令牌
            stateManager.set('accessToken', tokenData.access_token);
            
            // 清理临时存储
            try {
                const pkceMap = JSON.parse(sessionStorage.getItem('gg_pkce_map') || '{}');
                if (state && pkceMap[state]) {
                    delete pkceMap[state];
                }
                sessionStorage.setItem('gg_pkce_map', JSON.stringify(pkceMap));
            } catch (e) {
                console.error('清理PKCE参数失败:', e);
            }
            
            return {
                success: true,
                accessToken: tokenData.access_token
            };
        } catch (error) {
            console.error('OAuth回调处理失败:', error);
            throw error;
        }
    }
}

// 创建单例实例
export const oauthHandler = new OAuthHandler();