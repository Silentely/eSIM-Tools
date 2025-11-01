/**
 * Giffgaff eSIM 工具 - 主应用入口
 * 整合所有模块，处理事件绑定和应用初始化
 */

import { stateManager } from './modules/state-manager.js';
import { uiController } from './modules/ui-controller.js';
import { oauthHandler } from './modules/oauth-handler.js';
import { cookieHandler } from './modules/cookie-handler.js';
import { mfaHandler } from './modules/mfa-handler.js';
import { esimService } from './modules/esim-service.js';
import { 
    isServiceTimeAvailable, 
    showServiceTimeWarning, 
    copyTextFromCode,
    showToast,
    openTutorial 
} from './modules/utils.js';
import { t, tl } from '../../js/modules/i18n.js';

class GiffgaffApp {
    constructor() {
        this.initialized = false;
    }
    
    /**
     * 初始化应用
     */
    async init() {
        if (this.initialized) return;
        
        console.log(t('giffgaff.app.console.initStart'));
        
        // 订阅状态变化
        stateManager.subscribe((state) => {
            uiController.updateStatusPanel();
        });
        
        // 绑定事件监听器
        this.bindEventListeners();
        
        // 初始化服务时间检查
        this.initServiceTimeCheck();
        
        // 恢复会话
        const sessionRestored = stateManager.loadSession();
        
        if (sessionRestored) {
            this.handleSessionRestore();
        } else {
            uiController.showSection(1);
        }
        
        // 更新状态显示
        uiController.updateStatusPanel();
        
        // 启动Cookie监控（如果有）
        if (stateManager.getCookie()) {
            cookieHandler.startValidityMonitor();
        }
        
        this.initialized = true;
        console.log(t('giffgaff.app.console.initDone'));
    }
    
    /**
     * 绑定所有事件监听器
     */
    bindEventListeners() {
        const { elements } = uiController;
        
        // ===== Step 1: 登录方式选择 =====
        this.bindLoginMethodSelection();
        
        // OAuth登录
        elements.oauthLoginBtn?.addEventListener('click', () => this.handleOAuthLogin());
        elements.processCallbackBtn?.addEventListener('click', () => this.handleOAuthCallback());
        
        // Cookie登录
        elements.verifyCookieBtn?.addEventListener('click', () => this.handleCookieVerify());
        
        // ===== Step 2: MFA验证 =====
        elements.sendEmailBtn?.addEventListener('click', () => this.handleSendMFA());
        elements.verifyEmailBtn?.addEventListener('click', () => this.handleVerifyMFA());
        
        // ===== Step 3: 会员信息 =====
        elements.getMemberBtn?.addEventListener('click', () => this.handleGetMember());
        
        // ===== Step 4: eSIM预订和激活 =====
        this.bindStep4Actions();
        
        // ===== Step 5: 获取Token =====
        elements.getESimTokenBtn?.addEventListener('click', () => this.handleGetToken());
        
        // ===== 通用操作 =====
        elements.clearSessionBtn?.addEventListener('click', () => this.handleClearSession());
        
        // 步骤点击跳转
        this.bindStepNavigation();
        
        // Cookie过期事件
        window.addEventListener('cookieExpired', (e) => this.handleCookieExpired(e));
        
        // 复制控制台代码按钮
        this.bindCopyConsoleSnippet();
    }
    
    /**
     * 绑定登录方式选择
     */
    bindLoginMethodSelection() {
        const oauthCard = document.getElementById('oauthCard');
        const cookieCard = document.getElementById('cookieCard');
        
        const bindCard = (el, method) => {
            if (!el || el.__bound) return;
            el.__bound = true;
            const handler = () => uiController.selectLoginMethod(method);
            el.addEventListener('click', handler);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler();
                }
            });
        };
        
        bindCard(oauthCard, 'oauth');
        bindCard(cookieCard, 'cookie');
    }
    
    /**
     * 绑定Step4操作
     */
    bindStep4Actions() {
        // 激活方式卡片选择
        const manualCard = document.getElementById('manualActivateCard');
        const smsCard = document.getElementById('smsActivateCard');
        
        // SMS激活卡片
        if (smsCard && !smsCard.__bound) {
            smsCard.__bound = true;
            const handler = () => {
                const smsSection = document.getElementById('smsInlineSection');
                const manualBlock = document.getElementById('manualBlock');
                if (manualBlock) manualBlock.style.display = 'none';
                if (smsSection) {
                    smsSection.style.display = 'block';
                    smsSection.scrollIntoView({behavior:'smooth', block:'center'});
                }
            };
            smsCard.addEventListener('click', handler);
            smsCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler();
                }
            });
        }
        
        // SMS内联流程
        this.bindSmsInlineFlow();
        
        // 手动输入eSIM信息
        this.bindManualEsimInput();
        
        // 预订eSIM按钮
        const reserveBtn = document.getElementById('reserveESimBtn');
        reserveBtn?.addEventListener('click', () => this.handleReserveESim());
        
        // 确认激活按钮（委托绑定）
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#confirmActivationBtn');
            if (btn) {
                e.preventDefault();
                uiController.showSection(5);
            }
        });
    }
    
    /**
     * 绑定SMS内联流程
     */
    bindSmsInlineFlow() {
        const sendBtn = document.getElementById('smsInlineSendBtn');
        const verifyBtn = document.getElementById('smsInlineVerifyBtn');
        
        if (sendBtn && !sendBtn.__bound) {
            sendBtn.__bound = true;
            sendBtn.addEventListener('click', () => this.handleSmsSend());
        }
        
        if (verifyBtn && !verifyBtn.__bound) {
            verifyBtn.__bound = true;
            verifyBtn.addEventListener('click', () => this.handleSmsVerify());
        }
    }
    
    /**
     * 绑定手动eSIM输入
     */
    bindManualEsimInput() {
        const toggleBtn = document.getElementById('manualEsimInputToggle');
        const section = document.getElementById('manualEsimInputSection');
        const saveBtn = document.getElementById('manualSaveAndNextBtn');
        
        if (toggleBtn && !toggleBtn.__bound) {
            toggleBtn.__bound = true;
            toggleBtn.addEventListener('click', () => {
                section.style.display = section.style.display === 'none' ? 'block' : 'none';
            });
        }
        
        if (saveBtn && !saveBtn.__bound) {
            saveBtn.__bound = true;
            saveBtn.addEventListener('click', () => this.handleManualEsimSave());
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
     * 绑定复制控制台代码按钮
     */
    bindCopyConsoleSnippet() {
        const btn = document.getElementById('copyConsoleSnippetBtn');
        const pre = document.getElementById('cookieConsoleSnippet');
        
        if (btn && pre && !btn.__bound) {
            btn.__bound = true;
            btn.addEventListener('click', () => {
                const txt = (pre.innerText || pre.textContent || '').trim();
                if (!txt) return;
                
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(txt)
                        .then(() => showToast(tl('代码已复制到剪贴板')))
                        .catch(() => {
                            this.fallbackCopy(txt);
                            showToast(tl('代码已复制'));
                        });
                } else {
                    this.fallbackCopy(txt);
                    showToast(tl('代码已复制'));
                }
            });
        }
    }
    
    /**
     * 降级复制方法
     */
    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
    
    // ===== 事件处理器 =====
    
    /**
     * 处理OAuth登录
     */
    async handleOAuthLogin() {
        const { elements } = uiController;
        
        // 检查服务时间
        if (!isServiceTimeAvailable()) {
            const shouldContinue = await showServiceTimeWarning();
            if (!shouldContinue) return;
        }
        
        try {
            elements.oauthLoginBtn.innerHTML = `<span class="loading"></span> ${tl('准备登录...')}`;
            elements.oauthLoginBtn.disabled = true;
            
            uiController.showStatus(elements.oauthStatus, t('giffgaff.app.status.oauthPreparing'), "success");
            
            const result = await oauthHandler.startOAuthLogin();
            
            elements.oauthCallbackSection.classList.add('active');
            uiController.showStatus(elements.oauthStatus, t('giffgaff.app.status.oauthOpened'), "success");
        } catch (error) {
            uiController.showStatus(elements.oauthStatus, t('giffgaff.app.error.oauthPrepare', { message: error.message }), "error");
        } finally {
            elements.oauthLoginBtn.innerHTML = `<i class="fas fa-sign-in-alt me-2"></i> ${tl('开始OAuth登录')}`;
            elements.oauthLoginBtn.disabled = false;
        }
    }
    
    /**
     * 处理OAuth回调
     */
    async handleOAuthCallback() {
        const { elements } = uiController;
        const callbackUrl = elements.callbackUrl.value.trim();
        
        if (!callbackUrl) {
            uiController.showStatus(elements.callbackStatus, tl('请输入回调URL'), "error");
            return;
        }
        
        try {
            elements.processCallbackBtn.innerHTML = `<span class="loading"></span> ${tl('处理中...')}`;
            elements.processCallbackBtn.disabled = true;
            
            uiController.showStatus(elements.callbackStatus, t('giffgaff.app.status.oauthProcessing'), "success");
            
            const result = await oauthHandler.processCallback(callbackUrl);
            
            uiController.showStatus(elements.callbackStatus, t('giffgaff.app.status.oauthSuccess'), "success");
            
            setTimeout(() => {
                uiController.showSection(2);
            }, 1500);
        } catch (error) {
            uiController.showStatus(elements.callbackStatus, t('giffgaff.app.error.oauthCallback', { message: error.message }), "error");
        } finally {
            elements.processCallbackBtn.innerHTML = `<i class="fas fa-check me-2"></i> ${tl('处理回调')}`;
            elements.processCallbackBtn.disabled = false;
        }
    }
    
    /**
     * 处理Cookie验证
     */
    async handleCookieVerify() {
        const { elements } = uiController;
        
        // 检查服务时间
        if (!isServiceTimeAvailable()) {
            const shouldContinue = await showServiceTimeWarning();
            if (!shouldContinue) return;
        }
        
        const cookie = elements.cookieInput.value.trim();
        if (!cookie) {
            uiController.showStatus(elements.cookieStatus, tl('请输入Cookie字符串'), "error");
            return;
        }
        
        try {
            elements.verifyCookieBtn.innerHTML = `<span class="loading"></span> ${tl('验证中...')}`;
            elements.verifyCookieBtn.disabled = true;
            
            uiController.showStatus(elements.cookieStatus, t('giffgaff.app.status.cookieVerifying'), "success");
            
            const result = await cookieHandler.verifyCookie(cookie);
            
            if (result.valid) {
                uiController.showStatus(elements.cookieStatus, 
                    t('giffgaff.app.status.cookieSuccess'), "success");
                
                setTimeout(() => {
                    uiController.showSection(2);
                }, 2000);
            } else if (result.partialSuccess) {
                uiController.showStatus(elements.cookieStatus, result.message, "error");
                
                // 提供继续按钮
                const continueBtn = document.createElement('button');
                continueBtn.className = 'btn btn-outline-primary mt-3';
                continueBtn.style.display = 'block';
                continueBtn.style.margin = '12px auto 0';
                continueBtn.innerHTML = `<i class="fas fa-arrow-right me-2"></i> ${tl('仍要继续到下一步')}`;
                continueBtn.onclick = () => {
                    stateManager.saveCookie(cookie);
                    uiController.showSection(2);
                    continueBtn.remove();
                };
                
                const nextSibling = elements.cookieStatus.nextElementSibling;
                if (!nextSibling || nextSibling !== continueBtn) {
                    elements.cookieStatus.parentNode.insertBefore(continueBtn, elements.cookieStatus.nextSibling);
                }
            } else {
                throw new Error(result.message || tl('Cookie验证失败'));
            }
        } catch (error) {
            uiController.showStatus(elements.cookieStatus, error.message, "error");
        } finally {
            elements.verifyCookieBtn.innerHTML = `<i class="fas fa-check-circle me-2"></i> ${tl('验证Cookie')}`;
            elements.verifyCookieBtn.disabled = false;
        }
    }
    
    /**
     * 处理发送MFA验证码
     */
    async handleSendMFA() {
        const { elements } = uiController;
        
        // 检查服务时间
        if (!isServiceTimeAvailable()) {
            const shouldContinue = await showServiceTimeWarning();
            if (!shouldContinue) return;
        }
        
        try {
            elements.sendEmailBtn.innerHTML = `<span class="loading"></span> ${tl('发送中...')}`;
            elements.sendEmailBtn.disabled = true;
            
            uiController.showStatus(elements.emailStatus, t('giffgaff.app.status.mfaSending'), "success");
            
            const channelSelect = document.getElementById('mfaChannelSelect');
            const channel = channelSelect ? channelSelect.value : 'EMAIL';
            
            await mfaHandler.sendMFAChallenge(channel);
            
            uiController.showStatus(elements.emailStatus, t('giffgaff.app.status.mfaSentSuccess'), "success");
            elements.emailVerificationSection.classList.add('active');
        } catch (error) {
            uiController.showStatus(elements.emailStatus, t('giffgaff.app.error.mfaSendFailed', { message: error.message }), "error");
        } finally {
            elements.sendEmailBtn.innerHTML = `<i class="fas fa-paper-plane me-2"></i> ${tl('发送验证码')}`;
            elements.sendEmailBtn.disabled = false;
        }
    }
    
    /**
     * 处理验证MFA验证码
     */
    async handleVerifyMFA() {
        const { elements } = uiController;
        const code = elements.emailCode.value.trim();
        
        if (!code) {
            uiController.showStatus(elements.emailVerifyStatus, tl('请输入验证码'), "error");
            return;
        }
        
        try {
            elements.verifyEmailBtn.innerHTML = `<span class="loading"></span> ${tl('验证中...')}`;
            elements.verifyEmailBtn.disabled = true;
            
            uiController.showStatus(elements.emailVerifyStatus, t('giffgaff.app.status.mfaVerifying'), "success");
            
            await mfaHandler.validateMFACode(code);
            
            uiController.showStatus(elements.emailVerifyStatus, t('giffgaff.app.status.mfaVerifiedSuccess'), "success");
            
            setTimeout(() => {
                uiController.showSection(3);
            }, 1000);
        } catch (error) {
            uiController.showStatus(elements.emailVerifyStatus, t('giffgaff.app.error.mfaVerifyFailed', { message: error.message }), "error");
        } finally {
            elements.verifyEmailBtn.innerHTML = `<i class="fas fa-check me-2"></i> ${tl('验证验证码')}`;
            elements.verifyEmailBtn.disabled = false;
        }
    }
    
    /**
     * 处理获取会员信息
     */
    async handleGetMember() {
        const { elements } = uiController;
        
        try {
            elements.getMemberBtn.innerHTML = `<span class="loading"></span> ${tl('获取中...')}`;
            elements.getMemberBtn.disabled = true;
            
            uiController.showStatus(elements.memberStatus, t('giffgaff.app.status.memberFetching'), "success");
            
            const result = await esimService.getMemberInfo();
            
            uiController.showStatus(elements.memberStatus, t('giffgaff.app.status.memberFetched'), "success");
            uiController.showMemberInfo(result.data);
            
            setTimeout(() => {
                uiController.showSection(4);
            }, 2000);
        } catch (error) {
            uiController.showStatus(elements.memberStatus, t('giffgaff.app.error.memberFailed', { message: error.message }), "error");
        } finally {
            elements.getMemberBtn.innerHTML = `<i class="fas fa-user-circle me-2"></i> ${tl('获取会员信息')}`;
            elements.getMemberBtn.disabled = false;
        }
    }
    
    /**
     * 处理预订eSIM
     */
    async handleReserveESim() {
        const { elements } = uiController;
        
        // 检查服务时间
        if (!isServiceTimeAvailable()) {
            const shouldContinue = await showServiceTimeWarning();
            if (!shouldContinue) return;
        }
        
        try {
            elements.reserveESimBtn.innerHTML = `<span class="loading"></span> ${tl('预订中...')}`;
            elements.reserveESimBtn.disabled = true;
            
            uiController.showStatus(elements.esimReserveStatus, t('giffgaff.app.status.reserveProcessing'), "success");
            
            const result = await esimService.reserveESim();
            
            const status = result.data.esim.deliveryStatus || 'RESERVED';
            uiController.showStatus(elements.esimReserveStatus, t('giffgaff.app.status.reserveSuccess', { status }), "success");
            
            // 显示eSIM信息和激活指导
            uiController.showESIMInfoAndGuide();
        } catch (error) {
            uiController.showStatus(elements.esimReserveStatus, t('giffgaff.app.error.reserveFailed', { message: error.message }), "error");
        } finally {
            elements.reserveESimBtn.innerHTML = `<i class="fas fa-bookmark me-2"></i> ${tl('预订eSIM')}`;
            elements.reserveESimBtn.disabled = false;
        }
    }
    
    /**
     * 处理SMS发送
     */
    async handleSmsSend() {
        const sendBtn = document.getElementById('smsInlineSendBtn');
        const statusEl = document.getElementById('smsInlineStatus');
        
        try {
            sendBtn.innerHTML = `<span class="loading"></span> ${tl('发送中...')}`;
            sendBtn.disabled = true;
            
            uiController.showStatus(statusEl, t('giffgaff.app.status.smsSending'), 'success');
            
            await mfaHandler.sendSimSwapMFAChallenge();
            
            uiController.showStatus(statusEl, t('giffgaff.app.status.smsSentSuccess'), 'success');
            
            const codeSection = document.getElementById('smsCodeInputSection');
            if (codeSection) codeSection.style.display = 'block';
        } catch (error) {
            uiController.showStatus(statusEl, t('giffgaff.app.error.smsSendFailed', { message: error.message }), 'error');
        } finally {
            sendBtn.innerHTML = `<i class="fas fa-paper-plane me-2"></i> ${tl('发送验证码')}`;
            sendBtn.disabled = false;
        }
    }
    
    /**
     * 处理SMS验证
     */
    async handleSmsVerify() {
        const verifyBtn = document.getElementById('smsInlineVerifyBtn');
        const codeInput = document.getElementById('smsInlineCode');
        const statusEl = document.getElementById('smsInlineStatus');
        
        const code = (codeInput?.value || '').trim();
        
        if (!/^\d{6}$/.test(code)) {
            uiController.showStatus(statusEl, tl('请输入6位数字验证码'), 'error');
            return;
        }
        
        try {
            verifyBtn.innerHTML = `<span class="loading"></span> ${tl('验证中...')}`;
            verifyBtn.disabled = true;
            
            uiController.showStatus(statusEl, t('giffgaff.app.status.smsVerifySuccess'), 'success');
            
            // 执行完整的SMS激活流程
            await esimService.smsActivateFlow(code);
            
            uiController.showSection(5);
            uiController.showESimResult();
        } catch (error) {
            uiController.showStatus(statusEl, t('giffgaff.app.error.smsActivateFailed', { message: error.message }), 'error');
        } finally {
            verifyBtn.innerHTML = `<i class="fas fa-check me-2"></i> ${tl('验证并继续激活')}`;
            verifyBtn.disabled = false;
        }
    }
    
    /**
     * 处理手动eSIM信息保存
     */
    handleManualEsimSave() {
        const activationInput = document.getElementById('manualActivationCode');
        const ssnInput = document.getElementById('manualSSN');
        
        const activationCode = (activationInput?.value || '').trim();
        const ssn = (ssnInput?.value || '').trim();
        
        if (!activationCode) {
            const statusEl = document.getElementById('esimReserveStatus');
            uiController.showStatus(statusEl, tl('请输入激活码'), 'error');
            return;
        }
        
        stateManager.setState({
            esimActivationCode: activationCode,
            esimSSN: ssn || stateManager.get('esimSSN'),
            esimDeliveryStatus: 'RESERVED'
        });
        
        // 更新显示
        const title = document.getElementById('esimStatusTitle');
        if (title) title.textContent = t('giffgaff.app.manual.esimStatusReserved');
        
        const displayActivationCode = document.getElementById('displayActivationCode');
        const displaySSN = document.getElementById('displaySSN');
        if (displayActivationCode) displayActivationCode.textContent = activationCode;
        if (displaySSN && ssn) displaySSN.textContent = ssn;
        
        const info = document.getElementById('esimInfoDisplay');
        if (info) info.style.display = 'block';
        
        uiController.showSection(5);
    }
    
    /**
     * 处理获取Token
     */
    async handleGetToken() {
        const { elements } = uiController;
        
        try {
            elements.getESimTokenBtn.innerHTML = `<span class="loading"></span> ${tl('获取中...')}`;
            elements.getESimTokenBtn.disabled = true;
            
            uiController.showStatus(elements.tokenStatus, t('giffgaff.app.status.tokenFetching'), "success");
            
            const state = stateManager.getState();
            await esimService.getESimDownloadToken(state.esimSSN);
            
            uiController.showStatus(elements.tokenStatus, t('giffgaff.app.status.tokenFetchedSuccess'), "success");
            uiController.showESimResult();
        } catch (error) {
            uiController.showStatus(elements.tokenStatus, t('giffgaff.app.error.tokenFailed', { message: error.message }), "error");
        } finally {
            elements.getESimTokenBtn.innerHTML = `<i class="fas fa-download me-2"></i> ${tl('获取eSIM Token')}`;
            elements.getESimTokenBtn.disabled = false;
        }
    }
    
    /**
     * 处理清除会话
     */
    handleClearSession() {
        if (confirm(tl('确定要清除所有会话数据吗？这将重置所有进度。'))) {
            cookieHandler.stopValidityMonitor();
            stateManager.clearSession();
            uiController.resetUI();
            uiController.showStatus(uiController.elements.loginMethodStatus, tl('会话已清除，请重新开始'), "success");
        }
    }
    
    /**
     * 处理Cookie过期
     */
    handleCookieExpired(event) {
        uiController.showSection(1);
        uiController.selectLoginMethod('cookie');
        
        if (uiController.elements.loginMethodStatus) {
            uiController.showStatus(
                uiController.elements.loginMethodStatus, 
                tl('Cookie已失效，请重新获取并验证。'), 
                'error'
            );
        }
        
        showToast(tl('Cookie已失效，请在第一步重新验证。'));
        
        const input = document.getElementById('cookieInput');
        if (input) setTimeout(() => input.focus(), 100);
    }
    
    /**
     * 处理会话恢复
     */
    handleSessionRestore() {
        const state = stateManager.getState();
        
        if (state.accessToken) {
            let targetStep = 1;
            
            if (state.emailSignature) {
                if (state.memberId && (state.esimActivationCode || state.esimSSN)) {
                    if (state.lpaString) {
                        targetStep = 5;
                        // LPA已获取，提示清理
                        setTimeout(() => {
                            uiController.showStatus(
                                uiController.elements.tokenStatus,
                                t('giffgaff.app.status.lpaFetchedOnce'),
                                'success'
                            );
                            
                            setTimeout(() => {
                                const shouldClear = confirm(t('giffgaff.app.prompt.clearAfterLpa'));
                                if (shouldClear) {
                                    this.handleClearSession();
                                }
                            }, 100);
                        }, 500);
                    } else {
                        targetStep = 4;
                    }
                } else {
                    targetStep = 3;
                }
            } else if (state.accessToken) {
                targetStep = 2;
            }
            
            uiController.showSection(Math.max(targetStep, state.currentStep));
            
            // 恢复eSIM信息显示
            if (state.esimActivationCode || state.esimSSN) {
                const esimInfoDisplay = document.getElementById('esimInfoDisplay');
                const displayActivationCode = document.getElementById('displayActivationCode');
                const displaySSN = document.getElementById('displaySSN');
                
                if (esimInfoDisplay) {
                    if (displayActivationCode) displayActivationCode.textContent = state.esimActivationCode || tl('未获取');
                    if (displaySSN) displaySSN.textContent = state.esimSSN || tl('未获取');
                    esimInfoDisplay.style.display = 'block';
                }
            }
        }
        
        // 提示恢复
        if (state.esimActivationCode || state.esimSSN) {
            const resumed = sessionStorage.getItem('gg_resumed_once');
            if (resumed !== '1') {
                sessionStorage.setItem('gg_resumed_once', '1');
                const ok = confirm(t('giffgaff.app.prompt.resumeEsim'));
                if (ok) {
                    if (state.memberId) {
                        uiController.showSection(4);
                    } else if (state.emailSignature) {
                        uiController.showSection(3);
                    } else {
                        uiController.showSection(2);
                    }
                }
            }
        }
    }
    
    /**
     * 初始化服务时间检查
     */
    initServiceTimeCheck() {
        this.checkServiceTime();
        
        // 对齐到下一分钟整点
        const msToNextMinute = 60000 - (Date.now() % 60000);
        setTimeout(() => {
            this.checkServiceTime();
            setInterval(() => this.checkServiceTime(), 60000);
        }, msToNextMinute);
    }
    
    /**
     * 检查服务时间
     */
    checkServiceTime() {
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                          now.getMinutes().toString().padStart(2, '0');
        const ukTime = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(now);
        
        // 更新时间显示
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = currentTime;
            timeElement.style.animation = 'none';
            timeElement.offsetHeight;
            timeElement.style.animation = 'time-update 0.5s ease-out';
        }
        
        const ukHint = document.getElementById('ukTimeHint');
        if (ukHint) ukHint.textContent = t('giffgaff.app.service.ukTime', { time: ukTime });
        
        // 更新服务时间提示
        const isOutside = !isServiceTimeAvailable();
        const alertElement = document.getElementById('serviceTimeAlert');
        const iconElement = document.getElementById('serviceTimeIcon');
        const messageElement = document.getElementById('serviceTimeMessage');
        const actionMessageElement = document.getElementById('actionMessage');
        
        if (isOutside) {
            alertElement.className = 'alert alert-warning mb-4';
            iconElement.className = 'fas fa-exclamation-triangle warning';
            messageElement.innerHTML = t('giffgaff.app.service.outside');
            actionMessageElement.innerHTML = t('giffgaff.app.service.outsideBadge');
            actionMessageElement.className = 'service-time-action-badge warning';
            actionMessageElement.style.display = 'block';
        } else {
            alertElement.className = 'alert alert-success mb-4';
            iconElement.className = 'fas fa-check-circle success';
            messageElement.innerHTML = t('giffgaff.app.service.inside');
            actionMessageElement.innerHTML = t('giffgaff.app.service.insideBadge');
            actionMessageElement.className = 'service-time-action-badge success';
            actionMessageElement.style.display = 'block';
        }
    }
}

// 创建应用实例
const app = new GiffgaffApp();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// 导出全局函数供HTML内联事件使用
window.copyTextFromCode = copyTextFromCode;
window.openTutorial = openTutorial;

export default app;
