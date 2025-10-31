/**
 * Cookie处理模块
 * 负责Cookie验证和有效性监控
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints } from './api-config.js';

export class CookieHandler {
    constructor() {
        this.validityTimer = null;
        this.CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟
        this.apiEndpoints = getApiEndpoints();
    }
    
    /**
     * 验证Cookie
     */
    async verifyCookie(cookie) {
        try {
            const response = await fetch(this.apiEndpoints.cookieVerify, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cookie })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    return { valid: false, message: 'Cookie已失效' };
                }
                throw new Error(`验证失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            const looksLikeJwt = typeof result.accessToken === 'string' && 
                                result.accessToken.includes('.') && 
                                result.accessToken.length > 200;
            
            if (result.success && result.valid && looksLikeJwt) {
                // 保存访问令牌和Cookie
                stateManager.set('accessToken', result.accessToken);
                stateManager.saveCookie(cookie);
                
                // 启动有效性监控
                this.startValidityMonitor();
                
                return {
                    valid: true,
                    accessToken: result.accessToken,
                    message: 'Cookie验证成功'
                };
            } else if (result.success && !result.valid) {
                return {
                    valid: false,
                    partialSuccess: true,
                    message: result.message || 'Cookie验证通过，但未获取到可用于API的访问令牌'
                };
            } else {
                throw new Error(result.message || 'Cookie验证失败');
            }
        } catch (error) {
            console.error('Cookie验证错误:', error);
            throw error;
        }
    }
    
    /**
     * 检查Cookie有效性
     */
    async checkCookieValidity() {
        try {
            const storedCookie = stateManager.getCookie();
            if (!storedCookie) {
                return { skipped: true };
            }
            
            const response = await fetch(this.apiEndpoints.cookieVerify, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cookie: storedCookie })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.handleCookieExpired();
                    return { valid: false };
                }
                return { transientError: true };
            }
            
            const result = await response.json();
            
            if (result && result.success && result.valid) {
                // 刷新访问令牌
                if (result.accessToken) {
                    stateManager.set('accessToken', result.accessToken);
                }
                return { valid: true };
            }
            
            this.handleCookieExpired();
            return { valid: false };
        } catch (err) {
            console.error('Cookie有效性检查错误:', err);
            return { transientError: true, error: err?.message };
        }
    }
    
    /**
     * 启动Cookie有效性监控
     */
    startValidityMonitor() {
        const hasCookie = !!stateManager.getCookie();
        if (!hasCookie || this.validityTimer) return;
        
        // 立即检查一次
        this.checkCookieValidity();
        
        // 定期检查
        this.validityTimer = setInterval(() => {
            this.checkCookieValidity();
        }, this.CHECK_INTERVAL);
    }
    
    /**
     * 停止Cookie有效性监控
     */
    stopValidityMonitor() {
        if (this.validityTimer) {
            clearInterval(this.validityTimer);
            this.validityTimer = null;
        }
    }
    
    /**
     * 处理Cookie过期
     */
    handleCookieExpired() {
        this.stopValidityMonitor();
        
        // 清除Cookie和令牌
        localStorage.removeItem('giffgaff_cookie');
        stateManager.setState({
            accessToken: '',
            emailSignature: ''
        });
        
        // 触发过期事件
        const event = new CustomEvent('cookieExpired', {
            detail: { message: 'Cookie已失效，请重新验证' }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 页面可见性变化处理
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this.stopValidityMonitor();
        } else if (document.visibilityState === 'visible') {
            if (stateManager.getCookie()) {
                this.startValidityMonitor();
            }
        }
    }
}

// 创建单例实例
export const cookieHandler = new CookieHandler();

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
    cookieHandler.handleVisibilityChange();
});