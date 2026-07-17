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
import { isMobileBrowser, showMobileWarning } from '../../js/modules/browser-utils.js';
import Logger from '../../js/modules/logger.js';
import { installDiagnosticsGlobal } from '../../js/modules/diagnostics.js';

class SimyoApp {
    constructor() {
        this.initialized = false;
        this.activeRequests = new Set(); // 追踪活跃的异步请求
        this._beforeunloadExempt = false; // 关键操作完成后豁免 beforeunload 拦截
    }

    /**
     * 初始化应用
     */
    async init() {
        if (this.initialized) return;

        Logger.log(t('simyo.app.console.initStart'));
        try { Logger.env(); } catch (_) {}
        Logger.log('[Simyo] 页面:', window.location.href);
        Logger.log('[Simyo] UserAgent:', navigator.userAgent);
        Logger.log('[Simyo] 语言:', navigator.language);

        // 订阅状态变化
        stateManager.subscribe((state) => {
            Logger.log('[Simyo] 状态变更:', JSON.stringify({
                hasSessionToken: !!state.sessionToken,
                hasPhoneNumber: !!state.phoneNumber,
                hasActivationCode: !!state.activationCode,
                currentStep: state.currentStep
            }));
            uiController.updateStatusPanel();
        });

        // 绑定事件监听器
        Logger.log('[Simyo] 绑定事件监听器...');
        this.bindEventListeners();

        // 恢复会话
        Logger.log('[Simyo] 尝试恢复会话...');
        const sessionRestored = stateManager.loadSession();
        Logger.log('[Simyo] 会话恢复结果:', sessionRestored ? '成功' : '无会话');

        if (sessionRestored) {
            this.handleSessionRestore();
        } else {
            uiController.showSection(1);
        }

        // 更新状态显示
        uiController.updateStatusPanel();

        // 控制台：copyEsimDiagnostics() 复制脱敏诊断信息到剪贴板（便于贴 Issue）
        installDiagnosticsGlobal({
            app: 'simyo',
            getState: () => stateManager.getState()
        });

        this.initialized = true;
        Logger.log(t('simyo.app.console.initDone'));
    }

    /**
     * 绑定所有事件监听器
     */
    bindEventListeners() {
        const { elements } = uiController;

        // ===== Step 1: 登录 =====
        if (elements.loginBtn) elements.loginBtn.addEventListener('click', () => this.handleLogin());

        // ===== 设备更换流程 =====
        this.bindDeviceChangeFlow();

        // ===== Step 2: 获取eSIM =====
        if (elements.getEsimBtn) elements.getEsimBtn.addEventListener('click', () => this.handleGetEsim());

        // ===== Step 3: 生成二维码 =====
        if (elements.generateQrBtn) elements.generateQrBtn.addEventListener('click', () => this.handleGenerateQR());

        // 下一步：确认安装
        const nextToConfirmBtn = document.getElementById('nextToConfirmBtn');
        if (nextToConfirmBtn) nextToConfirmBtn.addEventListener('click', () => {
            uiController.showSection(4);
        });

        // ===== Step 4: 确认安装 =====
        if (elements.confirmInstallBtn) elements.confirmInstallBtn.addEventListener('click', () => this.handleConfirmInstall());

        // ===== 通用操作 =====
        if (elements.clearSessionBtn) elements.clearSessionBtn.addEventListener('click', () => this.handleClearSession());

        // 帮助按钮
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) helpBtn.addEventListener('click', () => openHelp());

        // 步骤点击跳转
        this.bindStepNavigation();

        // 返回按钮
        this.bindBackButtons();

        // 请求进行中或关键步骤时拦截刷新/后退
        this.bindBeforeUnloadGuard();
    }

    /**
     * 绑定设备更换流程
     */
    bindDeviceChangeFlow() {
        // 请求设备更换
        const applyBtn = document.getElementById('applyNewEsimBtn');
        if (applyBtn && !applyBtn.__bound) {
            applyBtn.__bound = true;
            applyBtn.addEventListener('click', () => this.handleApplyNewEsim());
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
     * 绑定步骤导航（含请求进行中守卫）
     */
    bindStepNavigation() {
        document.addEventListener('click', (e) => {
            const stepEl = e.target.closest('.step-indicator .step');
            if (stepEl && stepEl.dataset && stepEl.dataset.step) {
                const target = parseInt(stepEl.dataset.step, 10);
                const currentStep = stateManager.get('currentStep');

                // 请求进行中时拦截导航
                if (this.activeRequests.size > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    const confirmed = confirm(t('simyo.app.warning.requestInProgress'));
                    if (!confirmed) return;
                    // 用户确认后退，清除活跃请求标记
                    this.activeRequests.clear();
                }

                if (!isNaN(target) && target <= currentStep) {
                    e.preventDefault();
                    uiController.showSection(target);
                }
            }
        });
    }

    /**
     * 绑定 beforeunload 守卫（拦截页面刷新/关闭）
     * 浏览器会显示默认的"离开此页面？"提示
     */
    bindBeforeUnloadGuard() {
        window.addEventListener('beforeunload', (event) => {
            // 关键操作完成后豁免拦截
            if (this._beforeunloadExempt) return;

            const currentStep = stateManager.get('currentStep');
            // 请求进行中或处于 Step 3/4 关键阶段时拦截
            if (this.activeRequests.size > 0 || currentStep === 3 || currentStep === 4) {
                event.preventDefault();
                event.returnValue = ''; // Chrome 需要设置 returnValue
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
        Logger.log('[Simyo] === 登录开始 ===');

        // 手机环境检测：非PC环境弹出提醒
        if (isMobileBrowser()) {
            showMobileWarning();
        }

        if (!phoneNumberEl || !passwordEl) {
            Logger.error('[Simyo] 登录表单元素未找到！');
            return;
        }

        const phoneNumber = phoneNumberEl.value.trim();
        const password = passwordEl.value.trim();
        Logger.log('[Simyo] 手机号长度:', phoneNumber.length, ', 密码长度:', password.length);

        if (!phoneNumber || !password) {
            Logger.warn('[Simyo] 手机号或密码为空');
            uiController.showStatus(loginStatus, t('simyo.app.validation.loginForm'), "error");
            return;
        }

        try {
            loginBtn.innerHTML = `<span class="loading"></span> ${tl('登录中...')}`;
            loginBtn.disabled = true;

            uiController.showStatus(loginStatus, t('simyo.app.status.loginValidating'), "success");

            Logger.log('[Simyo] 调用 authHandler.login()...');
            const result = await authHandler.login(phoneNumber, password);
            Logger.log('[Simyo] 登录成功:', result.message);

            uiController.showStatus(loginStatus, result.message || t('simyo.app.status.loginSuccess'), "success");

            // 直接进入设备更换流程
            await delay(1000);
            uiController.showDeviceChangeSteps();
            this.bindDeviceChangeFlow();
        } catch (error) {
            Logger.error('[Simyo] 登录失败:', error.message, error);
            uiController.showStatus(loginStatus, t('simyo.app.error.loginFailed', { message: error.message }), "error");
        } finally {
            loginBtn.innerHTML = `<i class="fas fa-sign-in-alt me-2"></i> ${tl('登录账户')}`;
            loginBtn.disabled = false;
        }
    }

    /**
     * 处理设备更换请求
     */
    async handleApplyNewEsim() {
        const applyBtn = document.getElementById('applyNewEsimBtn');
        const statusEl = document.getElementById('applyNewEsimStatus');
        Logger.log('[Simyo] === 请求设备更换 ===');

        // 手机环境检测：非PC环境弹出提醒
        if (isMobileBrowser()) {
            showMobileWarning();
        }

        try {
            applyBtn.innerHTML = `<span class="loading"></span> ${tl('处理中...')}`;
            applyBtn.disabled = true;

            uiController.showStatus(statusEl, t('simyo.app.status.applyProcessing'), "success");

            Logger.log('[Simyo] 调用 deviceChangeHandler.applyNewEsim()...');
            const result = await deviceChangeHandler.applyNewEsim();
            Logger.log('[Simyo] 设备更换请求成功:', result.message);

            uiController.showStatus(statusEl, result.message || t('simyo.app.status.applySuccess'), "success");

            // 新版流程使用邮箱验证码：引导用户直接输入验证码
            const codeInput = document.getElementById('validationCodeInput');
            const verifyBtn = document.getElementById('verifyCodeBtn');
            if (codeInput) {
                codeInput.focus();
                const hasValidCode = /^\d{6}$/.test(codeInput.value.trim());
                if (verifyBtn) verifyBtn.disabled = !hasValidCode;
            }

            // 显示下一步提示
            if (result.nextStep) {
                await delay(3000);
                uiController.showStatus(statusEl, result.nextStep, "info");
            }
        } catch (error) {
            Logger.error('[Simyo] 设备更换请求失败:', error.message, error);
            uiController.showStatus(statusEl, t('simyo.app.error.applyFailed', { message: error.message }), "error");
        } finally {
            applyBtn.innerHTML = `<i class="fas fa-plus me-2"></i>${tl('请求设备更换')}`;
            applyBtn.disabled = false;
        }
    }

    /**
     * 处理验证验证码
     */
    async handleVerifyCode() {
        const verifyBtn = document.getElementById('verifyCodeBtn');
        const statusEl = document.getElementById('verifyCodeStatus');
        const codeInput = document.getElementById('validationCodeInput');
        Logger.log('[Simyo] === 验证码校验 ===');

        const validationCode = codeInput.value.trim();
        Logger.log('[Simyo] 验证码长度:', validationCode.length);

        try {
            verifyBtn.innerHTML = `<span class="loading"></span> ${tl('验证中...')}`;
            verifyBtn.disabled = true;

            uiController.showStatus(statusEl, t('simyo.app.status.verifyProcessing'), "success");

            Logger.log('[Simyo] 调用 deviceChangeHandler.verifyCode()...');
            const result = await deviceChangeHandler.verifyCode(validationCode);
            Logger.log('[Simyo] 验证码校验成功:', result.message);

            uiController.showStatus(statusEl, result.message || t('simyo.app.status.verifySuccess'), "success");

            // 显示下一步提示并自动进入获取eSIM步骤
            if (result.nextStep) {
                await delay(2000);
                uiController.showStatus(statusEl, result.nextStep, "info");
            }

            await delay(2000);
            uiController.skipDeviceChange();
        } catch (error) {
            Logger.error('[Simyo] 验证码校验失败:', error.message, error);
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
        Logger.log('[Simyo] === 获取 eSIM ===');

        try {
            elements.getEsimBtn.innerHTML = `<span class="loading"></span> ${tl('获取中...')}`;
            elements.getEsimBtn.disabled = true;

            uiController.showStatus(elements.esimStatus, t('simyo.app.status.getEsimProcessing'), "success");

            Logger.log('[Simyo] 调用 esimService.getEsim()...');
            const result = await esimService.getEsim();
            Logger.log('[Simyo] eSIM 获取成功:', result.message);

            uiController.showStatus(elements.esimStatus, result.message || t('simyo.app.status.getEsimSuccess'), "success");
            uiController.showEsimInfo(result.data);

            // 进入下一步
            await delay(2000);
            uiController.showSection(3);
        } catch (error) {
            Logger.error('[Simyo] eSIM 获取失败:', error.message, error);
            uiController.showStatus(elements.esimStatus, t('simyo.app.error.getEsimFailed', { message: error.message }), "error");
        } finally {
            elements.getEsimBtn.innerHTML = `<i class="fas fa-sim-card me-2"></i> ${tl('获取eSIM')}`;
            elements.getEsimBtn.disabled = false;
        }
    }

    /**
     * 处理生成二维码（合并获取eSIM和生成二维码）
     */
    async handleGenerateQR() {
        const { elements } = uiController;
        Logger.log('[Simyo] === 生成二维码 ===');

        const requestId = 'generateQR_' + Date.now();

        try {
            this.activeRequests.add(requestId);
            elements.generateQrBtn.innerHTML = `<span class="loading"></span> ${tl('生成中...')}`;
            elements.generateQrBtn.disabled = true;

            // 第一步：获取eSIM信息
            uiController.showStatus(elements.qrStatus, t('simyo.app.status.getEsimProcessing'), "success");

            Logger.log('[Simyo] 步骤1: 获取 eSIM 信息...');
            const esimResult = await esimService.getEsim();

            // 用户已通过导航守卫离开当前步骤，忽略过期请求的结果
            if (!this.activeRequests.has(requestId)) return;

            Logger.log('[Simyo] eSIM 信息获取成功');

            uiController.showStatus(elements.qrStatus, esimResult.message || t('simyo.app.status.getEsimSuccess'), "success");
            uiController.showEsimInfo(esimResult.data);

            await delay(1000);

            // 第二步：生成二维码
            uiController.showStatus(elements.qrStatus, t('simyo.app.status.generateProcessing'), "success");

            Logger.log('[Simyo] 步骤2: 生成 LPA 字符串...');
            const qrResult = esimService.generateLPAString();
            Logger.log('[Simyo] LPA 字符串生成成功, 长度:', qrResult.lpaString && qrResult.lpaString.length);

            uiController.showQRResult(qrResult.lpaString);
            uiController.showStatus(elements.qrStatus, t('simyo.app.status.generateSuccess'), "success");

            // 绑定复制和下载按钮
            this.bindQRActions(qrResult.lpaString);

            // 显示"下一步"按钮
            const nextBtn = document.getElementById('nextToConfirmBtn');
            if (nextBtn) {
                nextBtn.style.display = 'block';
            }

            this._beforeunloadExempt = true; // 二维码已生成，解除 beforeunload 拦截
        } catch (error) {
            // 用户已通过导航守卫离开当前步骤，忽略过期请求的错误
            if (!this.activeRequests.has(requestId)) return;

            Logger.error('[Simyo] 二维码生成失败:', error.message, error);
            uiController.showStatus(elements.qrStatus, t('simyo.app.error.generateFailed', { message: error.message }), "error");
        } finally {
            this.activeRequests.delete(requestId);
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
            copyBtn.addEventListener('click', async () => {
                try {
                    await copyToClipboard(lpaString);
                    showToast(t('simyo.app.toast.lpaCopied'));
                } catch (error) {
                    Logger.warn('[Simyo] Failed to copy LPA string:', error);
                    showToast(tl('复制失败，请手动选择文本复制'));
                }
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
        Logger.log('[Simyo] === 确认安装 ===');

        const requestId = 'confirmInstall_' + Date.now();

        try {
            this.activeRequests.add(requestId);
            elements.confirmInstallBtn.innerHTML = `<span class="loading"></span> ${tl('确认中...')}`;
            elements.confirmInstallBtn.disabled = true;

            uiController.showStatus(elements.confirmStatus, t('simyo.app.status.confirmProcessing'), "success");

            Logger.log('[Simyo] 调用 esimService.confirmInstall()...');
            const result = await esimService.confirmInstall();

            // 用户已通过导航守卫离开当前步骤，忽略过期请求的结果
            if (!this.activeRequests.has(requestId)) return;

            Logger.log('[Simyo] 安装确认成功:', result.message);

            uiController.showStatus(elements.confirmStatus, result.message || t('simyo.app.status.confirmSuccess'), "success");
        } catch (error) {
            // 用户已通过导航守卫离开当前步骤，忽略过期请求的错误
            if (!this.activeRequests.has(requestId)) return;

            Logger.error('[Simyo] 安装确认失败:', error.message, error);
            uiController.showStatus(elements.confirmStatus, t('simyo.app.error.confirmFailed', { message: error.message }), "error");
        } finally {
            this.activeRequests.delete(requestId);
            elements.confirmInstallBtn.innerHTML = `<i class="fas fa-check me-2"></i> ${tl('确认安装')}`;
            elements.confirmInstallBtn.disabled = false;
        }
    }

    /**
     * 处理清除会话
     */
    handleClearSession() {
        Logger.log('[Simyo] === 清除会话 ===');
        if (confirm(t('simyo.app.prompt.clearSession'))) {
            stateManager.clearSession();
            this._beforeunloadExempt = false; // 重置 beforeunload 豁免
            this.activeRequests.clear(); // 清除所有活跃请求
            Logger.log('[Simyo] 会话已清除');
            uiController.resetUI();
            uiController.showStatus(uiController.elements.loginStatus, t('simyo.app.toast.sessionCleared'), "success");
        } else {
            Logger.log('[Simyo] 用户取消清除会话');
        }
    }

    /**
     * 处理会话恢复
     */
    handleSessionRestore() {
        const state = stateManager.getState();

        Logger.log('[Simyo] === 会话恢复 ===');
        Logger.log('[Simyo] 状态:', JSON.stringify({
            hasSessionToken: !!state.sessionToken,
            hasPhoneNumber: !!state.phoneNumber,
            hasActivationCode: !!state.activationCode,
            isDeviceChange: state.isDeviceChange,
            currentStep: state.currentStep
        }));

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
                const deviceChangeSteps = document.getElementById('deviceChangeSteps');
                const step1 = document.getElementById('step1');

                Logger.log('恢复设备更换模式...');

                // 隐藏登录页面
                if (step1) {
                    step1.classList.remove('active');
                    step1.style.display = 'none';
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
                // 直接显示设备更换流程
                Logger.log('显示设备更换流程...');
                uiController.showDeviceChangeSteps();
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
