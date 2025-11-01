/**
 * Simyo状态管理模块
 * 负责应用状态的集中管理、持久化和恢复
 */

export class StateManager {
    constructor() {
        this.state = {
            // 认证相关
            sessionToken: "",
            phoneNumber: "",
            password: "",
            
            // eSIM相关
            activationCode: "",
            validationCode: "",
            
            // 模式控制
            isDeviceChange: false,
            
            // 步骤控制
            currentStep: 1,
            
            // 时间戳
            timestamp: 0
        };
        
        this.listeners = [];
        this.SESSION_KEY = 'simyo_session';
        this.SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2小时
    }
    
    /**
     * 获取完整状态
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * 批量更新状态
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
     * 保存会话到localStorage
     */
    saveSession() {
        try {
            const sessionData = {
                sessionToken: this.state.sessionToken,
                phoneNumber: this.state.phoneNumber,
                activationCode: this.state.activationCode,
                validationCode: this.state.validationCode,
                isDeviceChange: this.state.isDeviceChange,
                currentStep: this.state.currentStep,
                timestamp: Date.now()
            };
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
        } catch (error) {
            console.error('保存会话失败:', error);
        }
    }
    
    /**
     * 从localStorage加载会话
     */
    loadSession() {
        try {
            const sessionData = localStorage.getItem(this.SESSION_KEY);
            if (!sessionData) return false;
            
            const data = JSON.parse(sessionData);
            const now = Date.now();
            
            // 检查是否超时
            if (now - data.timestamp >= this.SESSION_TIMEOUT) {
                localStorage.removeItem(this.SESSION_KEY);
                return false;
            }
            
            // 恢复状态
            this.state = {
                ...this.state,
                sessionToken: data.sessionToken || "",
                phoneNumber: data.phoneNumber || "",
                activationCode: data.activationCode || "",
                validationCode: data.validationCode || "",
                isDeviceChange: typeof data.isDeviceChange === 'boolean' ? data.isDeviceChange : false,
                currentStep: data.currentStep || 1,
                timestamp: data.timestamp
            };
            
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('恢复会话失败:', error);
            localStorage.removeItem(this.SESSION_KEY);
            return false;
        }
    }
    
    /**
     * 清除会话
     */
    clearSession() {
        // 重置状态
        this.state = {
            sessionToken: "",
            phoneNumber: "",
            password: "",
            activationCode: "",
            validationCode: "",
            isDeviceChange: false,
            currentStep: 1,
            timestamp: 0
        };
        
        // 清除存储
        localStorage.removeItem(this.SESSION_KEY);
        sessionStorage.removeItem('simyo_temp_data');
        sessionStorage.removeItem('simyo_resumed_once');
        
        this.notifyListeners();
    }
}

// 创建单例实例
export const stateManager = new StateManager();