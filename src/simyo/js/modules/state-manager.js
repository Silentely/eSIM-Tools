import { t } from '../../../js/modules/i18n.js';
import secureStorage from '../../../js/modules/secure-storage.js';
import Logger from '../../../js/modules/logger.js';

/**
 * Simyo状态管理模块
 * 负责应用状态的集中管理、持久化和恢复
 */

export class StateManager {
    constructor() {
        this.state = {
            // 认证相关（密码仅在登录请求时使用，不进入状态）
            sessionToken: "",
            phoneNumber: "",
            mfaStatus: "",
            mfaMethod: "",
            methodHint: "",
            /** 登录后待提交 OTP，业务接口不可用 */
            mfaPending: false,

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
        this.SESSION_TIMEOUT = 5 * 60 * 1000; // 5分钟
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
                Logger.error(t('simyo.state.log.listenerFailed'), error);
            }
        });
    }

    /**
     * 保存会话到localStorage
     */
    saveSession() {
        try {
            // 不持久化未完成 MFA 的临时会话，并清掉旧正式会话，避免刷新后误用
            if (this.state.mfaPending) {
                secureStorage.removeItem(this.SESSION_KEY);
                return;
            }
            const sessionData = {
                sessionToken: this.state.sessionToken,
                phoneNumber: this.state.phoneNumber,
                mfaStatus: this.state.mfaStatus,
                mfaMethod: this.state.mfaMethod,
                methodHint: this.state.methodHint,
                mfaPending: false,
                activationCode: this.state.activationCode,
                validationCode: this.state.validationCode,
                isDeviceChange: this.state.isDeviceChange,
                currentStep: this.state.currentStep,
                timestamp: Date.now()
            };
            secureStorage.setItem(this.SESSION_KEY, sessionData);
        } catch (error) {
            Logger.error(t('simyo.state.log.saveFailed'), error);
        }
    }

    /**
     * 从localStorage加载会话
     */
    loadSession() {
        try {
            const sessionData = secureStorage.getItem(this.SESSION_KEY);
            if (!sessionData) return false;

            const data = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
            const now = Date.now();

            // 检查是否超时
            if (now - data.timestamp >= this.SESSION_TIMEOUT) {
                secureStorage.removeItem(this.SESSION_KEY);
                return false;
            }

            // 恢复状态
            this.state = {
                ...this.state,
                sessionToken: data.sessionToken || "",
                phoneNumber: data.phoneNumber || "",
                mfaStatus: data.mfaStatus || "",
                mfaMethod: data.mfaMethod || "",
                methodHint: data.methodHint || "",
                mfaPending: false,
                activationCode: data.activationCode || "",
                validationCode: data.validationCode || "",
                isDeviceChange: typeof data.isDeviceChange === 'boolean' ? data.isDeviceChange : false,
                currentStep: data.currentStep || 1,
                timestamp: data.timestamp
            };

            this.notifyListeners();
            return true;
        } catch (error) {
            Logger.error(t('simyo.state.log.restoreFailed'), error);
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
            mfaStatus: "",
            mfaMethod: "",
            methodHint: "",
            mfaPending: false,
            activationCode: "",
            validationCode: "",
            isDeviceChange: false,
            currentStep: 1,
            timestamp: 0
        };

        // 清除存储
        secureStorage.removeItem(this.SESSION_KEY);
        secureStorage.removeItem('simyo_temp_data');
        secureStorage.removeItem('simyo_resumed_once');

        this.notifyListeners();
    }
}

// 创建单例实例
export const stateManager = new StateManager();
