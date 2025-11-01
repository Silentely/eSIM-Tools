/**
 * OAuth处理模块
 * 负责OAuth 2.0 PKCE认证流程
 */

import { stateManager } from './state-manager.js';
import { generateCodeVerifier, generateCodeChallenge, generateState } from './utils.js';
import { oauthConfig } from './api-config.js';
import { t } from '../../../js/modules/i18n.js';

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
                console.error(t('giffgaff.oauth.log.savePkceFailed'), e);
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
                message: t('giffgaff.oauth.status.windowOpened')
            };
        } catch (error) {
            console.error(t('giffgaff.oauth.log.prepareFailed'), error);
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
                throw new Error(t('giffgaff.oauth.errors.missingCode'));
            }
            
            console.log(t('giffgaff.oauth.log.codeFound'), code);
            console.log(t('giffgaff.oauth.log.stateFound'), state);
            
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
                    console.error(t('giffgaff.oauth.log.restoreVerifierFailed'), e);
                }
            }
            
            if (!codeVerifier) {
                throw new Error(t('giffgaff.oauth.errors.missingVerifier'));
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
                throw new Error(t('giffgaff.oauth.errors.tokenExchangeFailed', {
                    status: tokenResponse.status
                }));
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
                console.error(t('giffgaff.oauth.log.cleanupFailed'), e);
            }
            
            return {
                success: true,
                accessToken: tokenData.access_token
            };
        } catch (error) {
            console.error(t('giffgaff.oauth.log.callbackFailed'), error);
            throw error;
        }
    }
}

// 创建单例实例
export const oauthHandler = new OAuthHandler();
