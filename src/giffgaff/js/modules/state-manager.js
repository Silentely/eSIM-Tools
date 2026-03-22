/**
 * 状态管理模块
 * 负责应用状态的集中管理、持久化和恢复
 */

export class StateManager {
    constructor() {
        this.state = {
            // OAuth相关
            accessToken: "",
            codeVerifier: "",
            
            // Cookie相关
            cookie: "",
            
            // MFA相关
            emailCodeRef: "",
            emailSignature: "",
            
            // 会员信息
            memberId: "",
            memberName: "",
            phoneNumber: "",
            
            // eSIM相关
            esimSSN: "",
            esimActivationCode: "",
            esimDeliveryStatus: "",
            lpaString: "",
            
            // 模式
            isDeviceChange: true,
            
            // 步骤控制
            currentStep: 1
        };
        
        this.listeners = [];
        this.SESSION_KEY = 'giffgaff_session';
        this.COOKIE_KEY = 'giffgaff_cookie';
        this.SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2小时
    }
    
    /**
     * 获取状态
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * 更新状态
     */
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.notifyListeners();
        this.saveSession();
    }
    
    /**
     * 获取单个状态值
     */
    get(key) {
        return this.state[key];
    }
    
    /**
     * 设置单个状态值
     */
    set(key, value) {
        this.state[key] = value;
        this.notifyListeners();
        this.saveSession();
    }
    
    /**
     * 订阅状态变化
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    
    /**
     * 通知所有监听器
     */
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('状态监听器执行错误:', error);
            }
        });
    }

    /**
     * 安全读取localStorage，避免在受限环境抛出SecurityError
     */
    safeStorageGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.warn(`读取本地存储失败(${key}):`, error);
            return null;
        }
    }

    /**
     * 安全写入localStorage，避免在受限环境抛出SecurityError
     */
    safeStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.warn(`写入本地存储失败(${key}):`, error);
            return false;
        }
    }

    /**
     * 安全删除localStorage，避免在受限环境抛出SecurityError
     */
    safeStorageRemove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`删除本地存储失败(${key}):`, error);
            return false;
        }
    }
    
    /**
     * 保存会话到localStorage
     */
    saveSession() {
        try {
            const sessionData = {
                accessToken: this.state.accessToken,
                emailSignature: this.state.emailSignature,
                memberId: this.state.memberId,
                memberName: this.state.memberName,
                phoneNumber: this.state.phoneNumber,
                esimSSN: this.state.esimSSN,
                esimActivationCode: this.state.esimActivationCode,
                esimDeliveryStatus: this.state.esimDeliveryStatus,
                lpaString: this.state.lpaString,
                isDeviceChange: this.state.isDeviceChange,
                currentStep: this.state.currentStep,
                timestamp: Date.now()
            };
            this.safeStorageSet(this.SESSION_KEY, JSON.stringify(sessionData));
        } catch (error) {
            console.error('保存会话失败:', error);
        }
    }
    
    /**
     * 从localStorage加载会话
     */
    loadSession() {
        try {
            const sessionData = this.safeStorageGet(this.SESSION_KEY);
            if (!sessionData) return false;
            
            const data = JSON.parse(sessionData);
            const now = Date.now();
            
            // 检查是否超时
            if (now - data.timestamp >= this.SESSION_TIMEOUT) {
                this.safeStorageRemove(this.SESSION_KEY);
                return false;
            }
            
            // 恢复状态
            this.state = {
                ...this.state,
                accessToken: data.accessToken || "",
                emailSignature: data.emailSignature || "",
                memberId: data.memberId || "",
                memberName: data.memberName || "",
                phoneNumber: data.phoneNumber || "",
                esimSSN: data.esimSSN || "",
                esimActivationCode: data.esimActivationCode || "",
                esimDeliveryStatus: data.esimDeliveryStatus || "",
                lpaString: data.lpaString || "",
                isDeviceChange: typeof data.isDeviceChange === 'boolean' ? data.isDeviceChange : true,
                currentStep: data.currentStep || 1
            };
            
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('恢复会话失败:', error);
            this.safeStorageRemove(this.SESSION_KEY);
            return false;
        }
    }
    
    /**
     * 保存Cookie
     */
    saveCookie(cookie) {
        if (cookie && typeof cookie === 'string') {
            this.state.cookie = cookie;
            this.safeStorageSet(this.COOKIE_KEY, cookie);
        }
    }

    /**
     * 清除Cookie
     */
    removeCookie() {
        this.state.cookie = '';
        this.safeStorageRemove(this.COOKIE_KEY);
    }
    
    /**
     * 获取Cookie
     */
    getCookie() {
        return this.safeStorageGet(this.COOKIE_KEY) || this.state.cookie;
    }
    
    /**
     * 清除会话
     */
    clearSession() {
        // 重置状态
        this.state = {
            accessToken: "",
            codeVerifier: "",
            cookie: "",
            emailCodeRef: "",
            emailSignature: "",
            memberId: "",
            memberName: "",
            phoneNumber: "",
            esimSSN: "",
            esimActivationCode: "",
            esimDeliveryStatus: "",
            lpaString: "",
            isDeviceChange: true,
            currentStep: 1
        };
        
        // 清除存储
        this.safeStorageRemove(this.SESSION_KEY);
        this.safeStorageRemove(this.COOKIE_KEY);
        
        // 清除Cookie
        this.eraseCookie('giffgaff_access_token');
        this.eraseCookie('giffgaff_session');
        
        this.notifyListeners();
    }
    
    /**
     * Cookie操作辅助函数
     */
    setCookie(name, value, days) {
        const expires = days ? `; expires=${new Date(Date.now() + days * 864e5).toUTCString()}` : '';
        document.cookie = `${name}=${value || ''}${expires}; path=/`;
    }
    
    getCookieValue(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }
    
    eraseCookie(name) {
        document.cookie = `${name}=; Max-Age=-99999999; path=/`;
    }
}

// 创建单例实例
export const stateManager = new StateManager();
