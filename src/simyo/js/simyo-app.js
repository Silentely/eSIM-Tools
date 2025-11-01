/**
 * Simyo eSIM 工具 - 主应用入口
 * 整合所有模块，处理事件绑定和应用初始化
 */

import { stateManager } from './modules/state-manager.js';
import { uiController } from './modules/ui-controller.js';
import { authHandler } from './modules/auth-handler.js';
import { deviceChangeHandler } from './modules/device-change-handler.js';
import { esimService } from './modules/esim-service.js';
import { 
    copyToClipboard,
    showToast,
    openHelp,
    delay
} from './modules/utils.js';

class SimyoApp {
    constructor() {
        this.initialized = false;
    }
    
    /**
     * 初始化应用
     */
    async init() {
        if (this.initialized) return;
        
        console.log('Simyo eSIM申请工具初始化中...');
        
        // 订阅状态变化
        stateManager.subscribe((state) => {
            uiController.updateStatusPanel();
        });
        
        // 绑定事件监听器
        this.bindEventListeners();
        
        // 恢复会话
        const sessionRestored = stateManager.loadSession();
        
        if (sessionRestored) {
            this.handleSessionRestore();
        } else {
            uiController.showSection(1);
        }
        
        // 更新状态显示
        uiController.updateStatusPanel();
        
        this.initialized = true;
        console.log('Simyo eSIM申请工具已加载');
    }
    
    /**
     * 绑定所有事件监听器
     */
    bindEventListeners() {
        const { elements } = uiController;
        
        // ===== Step 1: 登录 =====
        elements.loginBtn?.addEventListener('click', () => this.handleLogin());
        
        // ===== 设备更换流程 =====
        this.bindDeviceChangeFlow();
        
        // ===== Step 2: 获取eSIM =====
        elements.getEsimBtn?.addEventListener('click', () => this.handleGetEsim());
        
        // ===== Step 3: 生成二维码 =====
        elements.generateQrBtn?.addEventListener('click', () => this.handleGenerateQR());
        
        // ===== Step 4: 确认安装 =====
        elements.confirmInstallBtn?.addEventListener('click', () => this.handleConfirmInstall());
        
        // ===== 通用操作 =====
        elements.clearSessionBtn?.addEventListener('click', () => this.handleClearSession());
        
        // 步骤点击跳转
        this.bindStepNavigation();
        
        // 返回按钮
        this.bindBackButtons();
    }
    
    /**
     * 绑定设备更换流程
     */
    bindDeviceChangeFlow() {
        // 申请新eSIM
        const applyBtn = document.getElementById('applyNewEsimBtn');
        if (applyBtn && !applyBtn.__bound) {
            applyBtn.__bound = true;
            applyBtn.addEventListener('click', () => this.handleApplyNewEsim());
        }
        
        // 发送短信验证码
        const sendSmsBtn = document.getElementById('sendSmsBtn');
        if (sendSmsBtn && !sendSmsBtn.__bound) {
            sendSmsBtn.__bound = true;
            sendSmsBtn.addEventListener('click', () => this.handleSendSmsCode());
        }
        
        // 验证验证码
        const verifyBtn = document.getElementById('verifyCodeBtn');
        if (verifyBtn && !verifyBtn.__bound) {
            verifyBtn.__bound = true;
            verifyBtn.addEventListener('click', () => this.handleVerifyCode());
        }
        
        // 验证码输入监听
        const codeInput = document.getElementById('validationCodeInput');
        if (codeInput && !codeInput.__bound) {
            codeInput.__bound = true;
            codeInput.addEventListener('input', function() {
                const verifyBtn = document.getElementById('verifyCodeBtn');
                if (verifyBtn) {
                    verifyBtn.disabled = this.value.length !== 6 || !/^\d{6}$/.test(this.value);
                }
            });
        }
    }
    
    /**
     * 绑定步骤导航
     */
    bindStepNavigation() {
        document.addEventListener('click', (e) => {
            const stepEl = e.target.closest('.step-indicator .step');
            if (stepEl && stepEl.dataset && stepEl.dataset.step) {
                const target = parseInt(stepEl.dataset.step, 10);
                const currentStep = stateManager.get('currentStep');
                if (!isNaN(target) && target <= currentStep) {
                    e.preventDefault();
                    uiController.showSection(target);
                }
            }
        });
    }
    
    /**
     * 绑定返回按钮
     */
    bindBackButtons() {
        document.addEventListener('click', (e) => {
            // 通用返回按钮
            const backBtn = e.target.closest('.back-step-btn');
            if (backBtn) {
                e.preventDefault();
                const currentStep = stateManager.get('currentStep');
                const prev = Math.max(1, currentStep - 1);
                if (prev < currentStep) {
                    uiController.showSection(prev);
                }
            }
            
            // 返回设备更换选项
            const backToOption = e.target.closest('#backToDeviceChangeOptionBtn');
            if (backToOption) {
                e.preventDefault();
                const deviceChangeOption = uiController.elements.deviceChangeOption;
                const deviceChangeSteps = uiController.elements.deviceChangeSteps;
                if (deviceChangeSteps) deviceChangeSteps.classList.remove('active');
                if (deviceChangeOption) deviceChangeOption.classList.add('active');
            }
        });
    }
    
    // ===== 事件处理器 =====
    
    /**
     * 处理登录
     */
    async handleLogin() {
        const { elements } = uiController;
        const phoneNumber = elements.phoneNumber.value.trim();
        const password = elements.password.value.trim();
        
        if (!phoneNumber || !password) {
            uiController.showStatus(elements.loginStatus, "请输入完整的登录信息", "error");
            return;
        }
        
        try {
            elements.loginBtn.innerHTML = '<span class="loading"></span> 登录中...';
            elements.loginBtn.disabled = true;
            
            uiController.showStatus(elements.loginStatus, "正在验证账户信息...", "success");
            
            const result = await authHandler.login(phoneNumber, password);
            
            uiController.showStatus(elements.loginStatus, result.message + "！", "success");
            
            // 显示设备更换选项
            await delay(1000);
            uiController.showDeviceChangeOption();
        } catch (error) {
            uiController.showStatus(elements.loginStatus, "登录失败：" + error.message, "error");
        } finally {
            elements.loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i> 登录账户';
            elements.loginBtn.disabled = false;
        }
    }
    
    /**
     * 处理申请新eSIM
     */
    async handleApplyNewEsim() {
        const applyBtn = document.getElementById('applyNewEsimBtn');
        const statusEl = document.getElementById('applyNewEsimStatus');
        
        try {
            applyBtn.innerHTML = '<span class="loading"></span> 申请中...';
            applyBtn.disabled = true;
            
            uiController.showStatus(statusEl, "正在申请新eSIM...", "success");
            
            const result = await deviceChangeHandler.applyNewEsim();
            
            uiController.showStatus(statusEl, result.message, "success");
            
            // 启用发送短信按钮
            const sendSmsBtn = document.getElementById('sendSmsBtn');
            if (sendSmsBtn) sendSmsBtn.disabled = false;
            
            // 显示下一步提示
            if (result.nextStep) {
                await delay(3000);
                uiController.showStatus(statusEl, result.nextStep, "info");
            }
        } catch (error) {
            uiController.showStatus(statusEl, "申请新eSIM失败：" + error.message, "error");
        } finally {
            applyBtn.innerHTML = '<i class="fas fa-plus me-2"></i>申请新eSIM';
            applyBtn.disabled = false;
        }
    }
    
    /**
     * 处理发送短信验证码
     */
    async handleSendSmsCode() {
        const sendBtn = document.getElementById('sendSmsBtn');
        const statusEl = document.getElementById('sendSmsStatus');
        
        try {
            sendBtn.innerHTML = '<span class="loading"></span> 发送中...';
            sendBtn.disabled = true;
            
            uiController.showStatus(statusEl, "正在发送验证码到短信...", "success");
            
            const result = await deviceChangeHandler.sendSmsCode();
            
            uiController.showStatus(statusEl, result.message, "success");
            
            // 启用验证码输入
            const codeInput = document.getElementById('validationCodeInput');
            if (codeInput) codeInput.disabled = false;
            
            // 显示下一步提示
            if (result.nextStep) {
                await delay(3000);
                uiController.showStatus(statusEl, result.nextStep, "info");
            }
        } catch (error) {
            uiController.showStatus(statusEl, "发送验证码失败：" + error.message, "error");
        } finally {
            sendBtn.innerHTML = '<i class="fas fa-sms me-2"></i>发送验证码到短信';
            sendBtn.disabled = false;
        }
    }
    
    /**
     * 处理验证验证码
     */
    async handleVerifyCode() {
        const verifyBtn = document.getElementById('verifyCodeBtn');
        const statusEl = document.getElementById('verifyCodeStatus');
        const codeInput = document.getElementById('validationCodeInput');
        
        const validationCode = codeInput.value.trim();
        
        try {
            verifyBtn.innerHTML = '<span class="loading"></span> 验证中...';
            verifyBtn.disabled = true;
            
            uiController.showStatus(statusEl, "正在验证验证码...", "success");
            
            const result = await deviceChangeHandler.verifyCode(validationCode);
            
            uiController.showStatus(statusEl, result.message, "success");
            
            // 显示下一步提示并自动进入获取eSIM步骤
            if (result.nextStep) {
                await delay(2000);
                uiController.showStatus(statusEl, result.nextStep, "info");
            }
            
            await delay(2000);
            uiController.skipDeviceChange();
        } catch (error) {
            uiController.showStatus(statusEl, "验证码验证失败：" + error.message, "error");
        } finally {
            verifyBtn.innerHTML = '<i class="fas fa-check me-2"></i>确认验证码';
            verifyBtn.disabled = true;
        }
    }
    
    /**
     * 处理获取eSIM
     */
    async handleGetEsim() {
        const { elements } = uiController;
        
        try {
            elements.getEsimBtn.innerHTML = '<span class="loading"></span> 获取中...';
            elements.getEsimBtn.disabled = true;
            
            uiController.showStatus(elements.esimStatus, "正在获取eSIM信息...", "success");
            
            const result = await esimService.getEsim();
            
            uiController.showStatus(elements.esimStatus, result.message + "！", "success");
            uiController.showEsimInfo(result.data);
            
            // 进入下一步
            await delay(2000);
            uiController.showSection(3);
        } catch (error) {
            uiController.showStatus(elements.esimStatus, "获取eSIM信息失败：" + error.message, "error");
        } finally {
            elements.getEsimBtn.innerHTML = '<i class="fas fa-sim-card me-2"></i> 获取eSIM';
            elements.getEsimBtn.disabled = false;
        }
    }
    
    /**
     * 处理生成二维码
     */
    async handleGenerateQR() {
        const { elements } = uiController;
        
        try {
            elements.generateQrBtn.innerHTML = '<span class="loading"></span> 生成中...';
            elements.generateQrBtn.disabled = true;
            
            uiController.showStatus(elements.qrStatus, "正在生成eSIM二维码...", "success");
            
            const result = esimService.generateLPAString();
            
            uiController.showQRResult(result.lpaString);
            uiController.showStatus(elements.qrStatus, "eSIM二维码生成成功！", "success");
            
            // 绑定复制和下载按钮
            this.bindQRActions(result.lpaString);
            
            // 进入下一步
            await delay(2000);
            uiController.showSection(4);
        } catch (error) {
            uiController.showStatus(elements.qrStatus, "二维码生成失败：" + error.message, "error");
        } finally {
            elements.generateQrBtn.innerHTML = '<i class="fas fa-qrcode me-2"></i> 生成二维码';
            elements.generateQrBtn.disabled = false;
        }
    }
    
    /**
     * 绑定二维码操作按钮
     */
    bindQRActions(lpaString) {
        const copyBtn = document.getElementById('copyLpaBtn');
        const downloadBtn = document.getElementById('downloadQrBtn');
        
        if (copyBtn && !copyBtn.__bound) {
            copyBtn.__bound = true;
            copyBtn.addEventListener('click', () => {
                copyToClipboard(lpaString);
                showToast('LPA激活码已复制到剪贴板');
            });
        }
        
        if (downloadBtn && !downloadBtn.__bound) {
            downloadBtn.__bound = true;
            downloadBtn.addEventListener('click', () => {
                uiController.downloadQRCode();
            });
        }
    }
    
    /**
     * 处理确认安装
     */
    async handleConfirmInstall() {
        const { elements } = uiController;
        
        try {
            elements.confirmInstallBtn.innerHTML = '<span class="loading"></span> 确认中...';
            elements.confirmInstallBtn.disabled = true;
            
            uiController.showStatus(elements.confirmStatus, "正在确认eSIM安装状态...", "success");
            
            const result = await esimService.confirmInstall();
            
            uiController.showStatus(elements.confirmStatus, result.message, "success");
        } catch (error) {
            uiController.showStatus(elements.confirmStatus, "确认安装失败：" + error.message, "error");
        } finally {
            elements.confirmInstallBtn.innerHTML = '<i class="fas fa-check me-2"></i> 确认安装';
            elements.confirmInstallBtn.disabled = false;
        }
    }
    
    /**
     * 处理清除会话
     */
    handleClearSession() {
        if (confirm('确定要清除所有会话数据吗？这将重置所有进度。')) {
            stateManager.clearSession();
            uiController.resetUI();
            uiController.showStatus(uiController.elements.loginStatus, "会话已清除，请重新登录", "success");
        }
    }
    
    /**
     * 处理会话恢复
     */
    handleSessionRestore() {
        const state = stateManager.getState();
        
        if (state.sessionToken) {
            // 恢复手机号
            if (state.phoneNumber && uiController.elements.phoneNumber) {
                uiController.elements.phoneNumber.value = state.phoneNumber;
            }
            
            // 根据状态决定显示位置
            if (state.activationCode) {
                // 已有激活码，提示用户
                setTimeout(() => {
                    const resumed = sessionStorage.getItem('simyo_resumed_once');
                    if (resumed !== '1') {
                        sessionStorage.setItem('simyo_resumed_once', '1');
                        
                        uiController.showStatus(
                            uiController.elements.qrStatus,
                            '已成功获取到 eSIM 二维码/LPA（仅显示一次）',
                            'success'
                        );
                        
                        setTimeout(() => {
                            const shouldClear = confirm('已成功获取到 eSIM 二维码/LPA。是否立即清空会话并重置？');
                            if (shouldClear) {
                                this.handleClearSession();
                            }
                        }, 100);
                    }
                }, 500);
                
                uiController.showSection(Math.max(3, state.currentStep));
            } else if (state.isDeviceChange) {
                // 设备更换模式
                uiController.elements.deviceChangeOption.style.display = 'none';
                uiController.elements.deviceChangeSteps.style.display = 'block';
                this.bindDeviceChangeFlow();
                uiController.showSection(Math.max(2, state.currentStep));
            } else {
                // 显示设备更换选项
                uiController.showDeviceChangeOption();
            }
        }
    }
}

// 创建应用实例
const app = new SimyoApp();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// 导出全局函数供HTML内联事件使用
window.openHelp = openHelp;
window.startDeviceChange = () => {
    uiController.showDeviceChangeSteps();
    app.bindDeviceChangeFlow();
};
window.skipDeviceChange = () => {
    uiController.skipDeviceChange();
};

export default app;