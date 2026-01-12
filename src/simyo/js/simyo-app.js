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
import { t, tl } from '../../js/modules/i18n.js';

class SimyoApp {
    constructor() {
        this.initialized = false;
    }
    
    /**
     * 初始化应用
     */
    async init() {
        if (this.initialized) return;
        
        console.log(t('simyo.app.console.initStart'));
        
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
        console.log(t('simyo.app.console.initDone'));
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

        // 帮助按钮
        const helpBtn = document.getElementById('helpBtn');
        helpBtn?.addEventListener('click', () => openHelp());

        // 设备更换选项按钮
        const startDeviceChangeBtn = document.getElementById('startDeviceChangeBtn');
        startDeviceChangeBtn?.addEventListener('click', () => {
            uiController.showDeviceChangeSteps();
            this.bindDeviceChangeFlow();
        });

        const skipDeviceChangeBtn = document.getElementById('skipDeviceChangeBtn');
        skipDeviceChangeBtn?.addEventListener('click', () => uiController.skipDeviceChange());

        const skipDeviceChangeAltBtn = document.getElementById('skipDeviceChangeAltBtn');
        skipDeviceChangeAltBtn?.addEventListener('click', () => uiController.skipDeviceChange());

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
        // 直接获取DOM元素，避免缓存问题
        const phoneNumberEl = document.getElementById('phoneNumber');
        const passwordEl = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        const loginStatus = document.getElementById('loginStatus');

        if (!phoneNumberEl || !passwordEl) {
            console.error('登录表单元素未找到！');
            return;
        }

        const phoneNumber = phoneNumberEl.value.trim();
        const password = passwordEl.value.trim();

        if (!phoneNumber || !password) {
            uiController.showStatus(loginStatus, t('simyo.app.validation.loginForm'), "error");
            return;
        }

        try {
            loginBtn.innerHTML = `<span class="loading"></span> ${tl('登录中...')}`;
            loginBtn.disabled = true;

            uiController.showStatus(loginStatus, t('simyo.app.status.loginValidating'), "success");

            const result = await authHandler.login(phoneNumber, password);

            uiController.showStatus(loginStatus, result.message || t('simyo.app.status.loginSuccess'), "success");

            // 显示设备更换选项
            await delay(1000);
            uiController.showDeviceChangeOption();
        } catch (error) {
            uiController.showStatus(loginStatus, t('simyo.app.error.loginFailed', { message: error.message }), "error");
        } finally {
            loginBtn.innerHTML = `<i class="fas fa-sign-in-alt me-2"></i> ${tl('登录账户')}`;
            loginBtn.disabled = false;
        }
    }
    
    /**
     * 处理申请新eSIM
     */
    async handleApplyNewEsim() {
        const applyBtn = document.getElementById('applyNewEsimBtn');
        const statusEl = document.getElementById('applyNewEsimStatus');
        
        try {
            applyBtn.innerHTML = `<span class="loading"></span> ${tl('申请中...')}`;
            applyBtn.disabled = true;
            
            uiController.showStatus(statusEl, t('simyo.app.status.applyProcessing'), "success");
            
            const result = await deviceChangeHandler.applyNewEsim();
            
            uiController.showStatus(statusEl, result.message || t('simyo.app.status.applySuccess'), "success");
            
            // 启用发送短信按钮
            const sendSmsBtn = document.getElementById('sendSmsBtn');
            if (sendSmsBtn) sendSmsBtn.disabled = false;
            
            // 显示下一步提示
            if (result.nextStep) {
                await delay(3000);
                uiController.showStatus(statusEl, result.nextStep, "info");
            }
        } catch (error) {
            uiController.showStatus(statusEl, t('simyo.app.error.applyFailed', { message: error.message }), "error");
        } finally {
            applyBtn.innerHTML = `<i class="fas fa-plus me-2"></i>${tl('申请新eSIM')}`;
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
            sendBtn.innerHTML = `<span class="loading"></span> ${tl('发送中...')}`;
            sendBtn.disabled = true;
            
            uiController.showStatus(statusEl, t('simyo.app.status.smsProcessing'), "success");
            
            const result = await deviceChangeHandler.sendSmsCode();
            
            uiController.showStatus(statusEl, result.message || t('simyo.app.status.smsSuccess'), "success");
            
            // 启用验证码输入
            const codeInput = document.getElementById('validationCodeInput');
            if (codeInput) codeInput.disabled = false;
            
            // 显示下一步提示
            if (result.nextStep) {
                await delay(3000);
                uiController.showStatus(statusEl, result.nextStep, "info");
            }
        } catch (error) {
            uiController.showStatus(statusEl, t('simyo.app.error.smsFailed', { message: error.message }), "error");
        } finally {
            sendBtn.innerHTML = `<i class="fas fa-sms me-2"></i>${tl('发送验证码到短信')}`;
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
            verifyBtn.innerHTML = `<span class="loading"></span> ${tl('验证中...')}`;
            verifyBtn.disabled = true;
            
            uiController.showStatus(statusEl, t('simyo.app.status.verifyProcessing'), "success");
            
            const result = await deviceChangeHandler.verifyCode(validationCode);
            
            uiController.showStatus(statusEl, result.message || t('simyo.app.status.verifySuccess'), "success");
            
            // 显示下一步提示并自动进入获取eSIM步骤
            if (result.nextStep) {
                await delay(2000);
                uiController.showStatus(statusEl, result.nextStep, "info");
            }
            
            await delay(2000);
            uiController.skipDeviceChange();
        } catch (error) {
            uiController.showStatus(statusEl, t('simyo.app.error.verifyFailed', { message: error.message }), "error");
        } finally {
            verifyBtn.innerHTML = `<i class="fas fa-check me-2"></i>${tl('确认验证码')}`;
            verifyBtn.disabled = true;
        }
    }
    
    /**
     * 处理获取eSIM
     */
    async handleGetEsim() {
        const { elements } = uiController;
        
        try {
            elements.getEsimBtn.innerHTML = `<span class="loading"></span> ${tl('获取中...')}`;
            elements.getEsimBtn.disabled = true;
            
            uiController.showStatus(elements.esimStatus, t('simyo.app.status.getEsimProcessing'), "success");
            
            const result = await esimService.getEsim();
            
            uiController.showStatus(elements.esimStatus, result.message || t('simyo.app.status.getEsimSuccess'), "success");
            uiController.showEsimInfo(result.data);
            
            // 进入下一步
            await delay(2000);
            uiController.showSection(3);
        } catch (error) {
            uiController.showStatus(elements.esimStatus, t('simyo.app.error.getEsimFailed', { message: error.message }), "error");
        } finally {
            elements.getEsimBtn.innerHTML = `<i class="fas fa-sim-card me-2"></i> ${tl('获取eSIM')}`;
            elements.getEsimBtn.disabled = false;
        }
    }
    
    /**
     * 处理生成二维码
     */
    async handleGenerateQR() {
        const { elements } = uiController;
        
        try {
            elements.generateQrBtn.innerHTML = `<span class="loading"></span> ${tl('生成中...')}`;
            elements.generateQrBtn.disabled = true;
            
            uiController.showStatus(elements.qrStatus, t('simyo.app.status.generateProcessing'), "success");
            
            const result = esimService.generateLPAString();
            
            uiController.showQRResult(result.lpaString);
            uiController.showStatus(elements.qrStatus, t('simyo.app.status.generateSuccess'), "success");
            
            // 绑定复制和下载按钮
            this.bindQRActions(result.lpaString);
            
            // 进入下一步
            await delay(2000);
            uiController.showSection(4);
        } catch (error) {
            uiController.showStatus(elements.qrStatus, t('simyo.app.error.generateFailed', { message: error.message }), "error");
        } finally {
            elements.generateQrBtn.innerHTML = `<i class="fas fa-qrcode me-2"></i> ${tl('生成二维码')}`;
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
                showToast(t('simyo.app.toast.lpaCopied'));
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
            elements.confirmInstallBtn.innerHTML = `<span class="loading"></span> ${tl('确认中...')}`;
            elements.confirmInstallBtn.disabled = true;
            
            uiController.showStatus(elements.confirmStatus, t('simyo.app.status.confirmProcessing'), "success");
            
            const result = await esimService.confirmInstall();
            
            uiController.showStatus(elements.confirmStatus, result.message || t('simyo.app.status.confirmSuccess'), "success");
        } catch (error) {
            uiController.showStatus(elements.confirmStatus, t('simyo.app.error.confirmFailed', { message: error.message }), "error");
        } finally {
            elements.confirmInstallBtn.innerHTML = `<i class="fas fa-check me-2"></i> ${tl('确认安装')}`;
            elements.confirmInstallBtn.disabled = false;
        }
    }
    
    /**
     * 处理清除会话
     */
    handleClearSession() {
        if (confirm(t('simyo.app.prompt.clearSession'))) {
            stateManager.clearSession();
            uiController.resetUI();
            uiController.showStatus(uiController.elements.loginStatus, t('simyo.app.toast.sessionCleared'), "success");
        }
    }
    
    /**
     * 处理会话恢复
     */
    handleSessionRestore() {
        const state = stateManager.getState();

        console.log('handleSessionRestore - state:', state);

        if (state.sessionToken) {
            // 恢复手机号
            const phoneNumberEl = document.getElementById('phoneNumber');
            if (state.phoneNumber && phoneNumberEl) {
                phoneNumberEl.value = state.phoneNumber;
            }

            // 根据状态决定显示位置
            if (state.activationCode) {
                // 已有激活码，提示用户
                setTimeout(() => {
                    const resumed = sessionStorage.getItem('simyo_resumed_once');
                    if (resumed !== '1') {
                        sessionStorage.setItem('simyo_resumed_once', '1');

                        const qrStatus = document.getElementById('qrStatus');
                        uiController.showStatus(
                            qrStatus,
                            t('simyo.app.status.lpaFetchedOnce'),
                            'success'
                        );

                        setTimeout(() => {
                            const shouldClear = confirm(t('simyo.app.prompt.clearAfterLpa'));
                            if (shouldClear) {
                                this.handleClearSession();
                            }
                        }, 100);
                    }
                }, 500);

                uiController.showSection(Math.max(3, state.currentStep));
            } else if (state.isDeviceChange) {
                // 设备更换模式
                const deviceChangeOption = document.getElementById('deviceChangeOption');
                const deviceChangeSteps = document.getElementById('deviceChangeSteps');
                const step1 = document.getElementById('step1');

                console.log('恢复设备更换模式...');

                // 隐藏登录页面和设备更换选项
                if (step1) step1.classList.remove('active');
                if (deviceChangeOption) {
                    deviceChangeOption.classList.remove('active');
                    deviceChangeOption.style.display = 'none';
                }

                // 显示设备更换流程
                if (deviceChangeSteps) {
                    deviceChangeSteps.classList.add('active');
                    deviceChangeSteps.style.display = 'block';  // 明确设置为 block
                }

                this.bindDeviceChangeFlow();

                // 更新步骤指示器，但不调用 showSection（避免移除 deviceChangeSteps 的 active 类）
                stateManager.set('currentStep', Math.max(2, state.currentStep));
                uiController.updateSteps(stateManager.get('currentStep'));
            } else {
                // 显示设备更换选项
                console.log('显示设备更换选项...');
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

export default app;
