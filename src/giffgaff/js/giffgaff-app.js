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
    openTutorial,
    getTimeUntilServiceOpen,
    copyLPAString,
    downloadQRCode
} from './modules/utils.js';
import { t, tl } from '../../js/modules/i18n.js';
import { isMobileBrowser, showMobileWarning } from '../../js/modules/browser-utils.js';
import captchaManager from '../../js/modules/captcha-manager.js';
import Logger from '../../js/modules/logger.js';

class GiffgaffApp {
    constructor() {
        this.initialized = false;
        this.countdownIntervalId = null;
        this.minuteIntervalId = null;
        this.minuteTimeoutId = null;
        this._isPageVisible = true; // 页面可见性状态
        this.activeRequests = new Set(); // 追踪活跃的异步请求（issue #66）
        this._beforeunloadExempt = false; // Token 获取成功后豁免 beforeunload 拦截
        this.setupGlobalErrorHandlers();
        this.setupVisibilityHandler(); // 监听页面可见性变化
    }

    /**
     * 设置全局错误处理器
     *
     * 职责边界：
     * - 本 handler 仅负责浏览器扩展噪音检测和用户通知
     * - 错误上报由 Sentry SDK 自动采集（onunhandledrejection 集成）
     * - 非 Error 类型的 rejection（如 { code, message }）由 Sentry beforeSend 过滤
     * - 禁止在此处手动调用 captureException，否则会与 Sentry 自动采集产生重复上报
     */
    setupGlobalErrorHandlers() {
        // 处理未捕获的 Promise 拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('[Giffgaff] Unhandled Promise Rejection:', event.reason);

            // 将 reason 统一为 Error 对象，用于噪音检测
            const error = this.normalizeUnhandledRejectionReason(event.reason);

            // 浏览器扩展噪音检查：命中忽略列表则静默吞掉，不通知用户
            if (error && this.isIgnoredUnhandledRejection(error)) {
                event.preventDefault();
                console.debug('[Giffgaff] Ignored browser noise rejection:', error.message);
                return;
            }

            // 非噪音错误：阻止浏览器默认行为，显示用户友好提示
            // 错误上报交给 Sentry 自动采集，不在这里手动 captureException
            if (error) {
                event.preventDefault();
                // 显示用户友好的错误提示（仅对有效 Error 对象，跳过原始类型 rejection）
                showToast(tl('操作失败，请重试或刷新页面'));
            }
        });
    }

    /**
     * 设置页面可见性监听器
     * 页面不可见时暂停定时器，节省CPU资源
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            this._isPageVisible = !document.hidden;
            if (document.hidden) {
                // 页面不可见，暂停所有定时器
                this.pauseTimers();
            } else {
                // 页面可见，恢复定时器
                this.resumeTimers();
            }
        });
    }

    /**
     * 暂停所有定时器
     */
    pauseTimers() {
        if (this.countdownIntervalId) {
            clearInterval(this.countdownIntervalId);
            this.countdownIntervalId = null;
        }
        if (this.minuteIntervalId) {
            clearInterval(this.minuteIntervalId);
            this.minuteIntervalId = null;
        }
        if (this.minuteTimeoutId) {
            clearTimeout(this.minuteTimeoutId);
            this.minuteTimeoutId = null;
        }
    }

    /**
     * 恢复定时器
     */
    resumeTimers() {
        if (this.initialized) {
            this.initServiceTimeCheck();
        }
    }

    normalizeUnhandledRejectionReason(reason) {
        if (reason instanceof Error) {
            return reason;
        }

        if (typeof reason === 'string') {
            return new Error(reason);
        }

        if (reason && typeof reason === 'object') {
            const errorMessage = reason.message || reason.error || JSON.stringify(reason);
            const error = new Error(errorMessage || tl('未知错误'));
            if (reason.code !== undefined) {
                error.code = reason.code;
            }
            if (reason.name) {
                error.name = reason.name;
            }
            if (reason.stack) {
                error.stack = reason.stack;
            }
            return error;
        }

        return null;
    }

    isIgnoredUnhandledRejection(error) {
        const payload = `${error?.message ?? ''}\n${error?.stack ?? ''}`.toLowerCase();
        const ignoredKeywords = [
            'wallet must has at least one account',
            'wallet must have at least one account',
            '4001',
            'autofillfielddata.autocompletetype.includes',
            'webkit-masked-url://',
            'chrome-extension://',
            'moz-extension://',
            'metamask',
            'tronlink',
            'backpack',
            'method not found'
        ];

        return ignoredKeywords.some((keyword) => payload.includes(keyword));
    }

    /**
     * 初始化应用
     */
    async init() {
        if (this.initialized) return;

        console.log(t('giffgaff.app.console.initStart'));
        try { Logger.env(); } catch (_) {}
        console.log('[Giffgaff] 页面:', window.location.href);
        console.log('[Giffgaff] UserAgent:', navigator.userAgent);
        console.log('[Giffgaff] 语言:', navigator.language);

        try {
            console.log('[Giffgaff] 初始化 CaptchaManager...');
            await captchaManager.init();
            console.log('[Giffgaff] CaptchaManager 初始化完成');
        } catch (error) {
            console.error('[Giffgaff] captcha init failed', error);
        }

        // 订阅状态变化
        stateManager.subscribe((state) => {
            console.log('[Giffgaff] 状态变更:', JSON.stringify({
                hasAccessToken: !!state.accessToken,
                hasEmailSignature: !!state.emailSignature,
                hasCookie: !!state.cookie,
                currentStep: state.currentStep
            }));
            // 离开 Step 5 时重置 beforeunload 豁免，确保后续关键步骤仍受保护
            if (this._beforeunloadExempt && state.currentStep !== 5) {
                this._beforeunloadExempt = false;
            }
            uiController.updateStatusPanel();
        });

        // 绑定事件监听器
        console.log('[Giffgaff] 绑定事件监听器...');
        this.bindEventListeners();

        // 初始化服务时间检查
        this.initServiceTimeCheck();

        // 恢复会话
        console.log('[Giffgaff] 尝试恢复会话...');
        const sessionRestored = stateManager.loadSession();
        console.log('[Giffgaff] 会话恢复结果:', sessionRestored ? '成功' : '无会话');

        if (sessionRestored) {
            this.handleSessionRestore();
        } else {
            uiController.showSection(1);
        }

        // 更新状态显示
        uiController.updateStatusPanel();

        // 启动Cookie监控（如果有）
        const cookie = stateManager.getCookie();
        const loginMethod = stateManager.get('accessToken') ? 'OAuth' : (cookie ? 'Cookie' : '未登录');
        console.log('[Giffgaff] 登录方式:', loginMethod, '| Cookie状态:', cookie ? '已存在，启动监控' : '无Cookie（正常）');
        if (cookie) {
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
        if (elements.oauthLoginBtn) elements.oauthLoginBtn.addEventListener('click', () => this.handleOAuthLogin());
        if (elements.processCallbackBtn) elements.processCallbackBtn.addEventListener('click', () => this.handleOAuthCallback());

        // Cookie登录
        if (elements.verifyCookieBtn) elements.verifyCookieBtn.addEventListener('click', () => this.handleCookieVerify());

        // ===== Step 2: MFA验证 =====
        if (elements.sendEmailBtn) elements.sendEmailBtn.addEventListener('click', () => this.handleSendMFA());
        if (elements.verifyEmailBtn) elements.verifyEmailBtn.addEventListener('click', () => this.handleVerifyMFA());

        // ===== Step 3: 会员信息 =====
        if (elements.getMemberBtn) elements.getMemberBtn.addEventListener('click', () => this.handleGetMember());

        // ===== Step 4: eSIM预订和激活 =====
        this.bindStep4Actions();

        // ===== Step 5: 获取Token =====
        if (elements.getESimTokenBtn) elements.getESimTokenBtn.addEventListener('click', () => this.handleGetToken());

        // ===== 通用操作 =====
        if (elements.clearSessionBtn) elements.clearSessionBtn.addEventListener('click', () => this.handleClearSession());

        // 步骤点击跳转
        this.bindStepNavigation();

        // 请求进行中或关键步骤时拦截刷新/后退（issue #66）
        this.bindBeforeUnloadGuard();

        // Cookie过期事件
        window.addEventListener('cookieExpired', (e) => this.handleCookieExpired(e));

        // 复制控制台代码按钮
        this.bindCopyConsoleSnippet();

        // 复制激活码和 SSN 按钮
        this.bindCopyCodeButtons();
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
                const directSection = document.getElementById('directFetchSection');
                if (manualBlock) manualBlock.style.display = 'none';
                if (directSection) directSection.style.display = 'none';
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

        // 直取eSIM流程
        this.bindDirectFetchActions();

        // 手动输入eSIM信息
        this.bindManualEsimInput();

        // 预订eSIM按钮
        const reserveBtn = document.getElementById('reserveESimBtn');
        if (reserveBtn) reserveBtn.addEventListener('click', () => this.handleReserveESim());

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
     * 绑定直取eSIM卡片与按钮事件
     */
    bindDirectFetchActions() {
        const directCard = document.getElementById('directFetchCard');
        if (directCard && !directCard.__bound) {
            directCard.__bound = true;
            const handler = () => this.handleDirectFetchExpand();
            directCard.addEventListener('click', handler);
            directCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler();
                }
            });
        }

        const pullBtn = document.getElementById('directFetchPullBtn');
        if (pullBtn && !pullBtn.__bound) {
            pullBtn.__bound = true;
            pullBtn.addEventListener('click', () => this.handleDirectFetchPull());
        }
    }

    /**
     * 处理直取eSIM卡片展开
     */
    handleDirectFetchExpand() {
        const manualBlock = document.getElementById('manualBlock');
        const smsSection = document.getElementById('smsInlineSection');
        const directSection = document.getElementById('directFetchSection');
        if (manualBlock) manualBlock.style.display = 'none';
        if (smsSection) smsSection.style.display = 'none';
        if (directSection) {
            directSection.style.display = 'block';
            directSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const pullBtn = document.getElementById('directFetchPullBtn');
            if (pullBtn) pullBtn.focus();
        }
    }

    /**
     * 处理直取eSIM拉取操作
     */
    async handleDirectFetchPull(preselectedSsn = null) {
        const pullBtn = document.getElementById('directFetchPullBtn');
        const statusEl = document.getElementById('directFetchStatus');
        if (!pullBtn || !statusEl) return;

        try {
            pullBtn.disabled = true;
            pullBtn.replaceChildren();
            const spinner = document.createElement('span');
            spinner.className = 'loading';
            pullBtn.appendChild(spinner);
            pullBtn.append(' ' + tl('拉取中...'));
            uiController.showStatus(statusEl, t('giffgaff.directFetch.status.fetching'), 'info');

            await esimService.directFetchFlow(preselectedSsn);
            uiController.showStatus(statusEl, t('giffgaff.directFetch.status.success'), 'success');

            setTimeout(() => {
                uiController.showSection(5);
                uiController.showESimResult();
            }, 800);
        } catch (error) {
            stateManager.set('directFetchMode', false);
            if (error.code === 'MULTIPLE_ESIMS') {
                this.renderSsnPicker(error.candidates);
                uiController.showStatus(statusEl, t('giffgaff.directFetch.errors.multipleNeedPick'), 'info');
            } else if (error.code === 'EMPTY_LIST') {
                uiController.showStatus(statusEl, t('giffgaff.directFetch.errors.empty'), 'error');
            } else {
                uiController.showStatus(statusEl, t('giffgaff.directFetch.errors.generic', { message: error.message }), 'error');
            }
        } finally {
            pullBtn.disabled = false;
            pullBtn.replaceChildren();
            const icon = document.createElement('i');
            icon.className = 'fas fa-bolt me-2';
            pullBtn.appendChild(icon);
            pullBtn.append(' ' + tl('拉取我的 eSIM'));
        }
    }

    /**
     * 渲染多eSIM选择器（radio列表 + 确认按钮）
     */
    renderSsnPicker(candidates) {
        const container = document.getElementById('directFetchSsnPicker');
        if (!container) return;

        container.replaceChildren();
        candidates.forEach((ssn, i) => {
            const row = document.createElement('div');
            row.className = 'form-check';
            const input = document.createElement('input');
            input.className = 'form-check-input';
            input.type = 'radio';
            input.name = 'directFetchSsn';
            input.id = `ssn-${i}`;
            input.value = String(ssn);
            if (i === 0) input.checked = true;
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = input.id;
            const code = document.createElement('code');
            code.textContent = String(ssn);
            label.appendChild(code);
            row.append(input, label);
            container.appendChild(row);
        });
        const confirmBtn = document.createElement('button');
        confirmBtn.id = 'directFetchSsnConfirmBtn';
        confirmBtn.className = 'btn btn-info mt-2';
        confirmBtn.textContent = tl('使用选定的 eSIM');
        container.appendChild(confirmBtn);
        container.style.display = 'block';

        if (!confirmBtn.__bound) {
            confirmBtn.__bound = true;
            confirmBtn.addEventListener('click', () => {
                const selected = container.querySelector('input[name="directFetchSsn"]:checked')?.value;
                if (!selected) return;
                container.style.display = 'none';
                this.handleDirectFetchPull(selected);
            });
        }
    }

    /**
     * 绑定步骤导航（issue #66: 添加导航守卫，防止请求进行中误操作）
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
                    const confirmed = confirm(t('giffgaff.app.warning.requestInProgress'));
                    if (!confirmed) return;
                    // 用户确认后退，清除活跃请求标记
                    // safe: handleGetToken 在 await 后会检查 has(requestId) 并提前 return
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
     * 绑定 beforeunload 守卫（issue #66: 拦截页面刷新/关闭）
     * 浏览器会显示默认的"离开此页面？"提示
     */
    bindBeforeUnloadGuard() {
        window.addEventListener('beforeunload', (event) => {
            // Token 获取成功后豁免拦截，用户可自由关闭页面
            if (this._beforeunloadExempt) return;

            const currentStep = stateManager.get('currentStep');
            // 请求进行中或处于 Step 4/5 关键阶段时拦截
            if (this.activeRequests.size > 0 || currentStep === 4 || currentStep === 5) {
                event.preventDefault();
                event.returnValue = ''; // Chrome 需要设置 returnValue
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
     * 绑定复制激活码和 SSN 按钮
     */
    bindCopyCodeButtons() {
        const copyActivationCodeBtn = document.getElementById('copyActivationCodeBtn');
        const copySSNBtn = document.getElementById('copySSNBtn');

        const bindCopyButton = (btn) => {
            if (btn && !btn.__bound) {
                btn.__bound = true;
                btn.addEventListener('click', () => {
                    const targetId = btn.getAttribute('data-target');
                    const targetElement = document.getElementById(targetId);
                    if (!targetElement) return;

                    const text = (targetElement.innerText || targetElement.textContent || '').trim();
                    if (!text) return;

                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(text)
                            .then(() => showToast(tl('已复制到剪贴板')))
                            .catch(() => {
                                this.fallbackCopy(text);
                                showToast(tl('已复制'));
                            });
                    } else {
                        this.fallbackCopy(text);
                        showToast(tl('已复制'));
                    }
                });
            }
        };

        bindCopyButton(copyActivationCodeBtn);
        bindCopyButton(copySSNBtn);
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
     * 提取回调URL
     * @param {string} text - 输入文本
     * @returns {string} 提取的URL或原始文本
     */
    extractCallbackUrl(text) {
        if (!text) return text;

        // 尝试提取 giffgaff:// 开头的URL
        // 匹配模式：giffgaff://auth/callback/?code=xxx&state=xxx
        const urlPattern = /(giffgaff:\/\/auth\/callback\/[^\s'"]*)/i;
        const match = text.match(urlPattern);

        if (match && match[1]) {
            return match[1];
        }

        // 如果没有匹配到，返回原始文本
        return text;
    }

    /**
     * 处理OAuth登录
     */
    async handleOAuthLogin() {
        const { elements } = uiController;
        console.log('[Giffgaff] === OAuth 登录开始 ===');

        // 手机环境检测：非PC环境弹出提醒
        if (isMobileBrowser()) {
            showMobileWarning();
        }

        // 检查服务时间
        if (!isServiceTimeAvailable()) {
            console.log('[Giffgaff] 服务时间外，显示警告');
            const shouldContinue = await showServiceTimeWarning();
            if (!shouldContinue) {
                console.log('[Giffgaff] 用户取消（服务时间外）');
                return;
            }
        }

        try {
            elements.oauthLoginBtn.innerHTML = `<span class="loading"></span> ${tl('准备登录...')}`;
            elements.oauthLoginBtn.disabled = true;

            uiController.showStatus(elements.oauthStatus, t('giffgaff.app.status.oauthPreparing'), "success");

            console.log('[Giffgaff] 调用 oauthHandler.startOAuthLogin()...');
            const result = await oauthHandler.startOAuthLogin();
            console.log('[Giffgaff] OAuth 登录启动成功:', result);

            elements.oauthCallbackSection.classList.add('active');
            uiController.showStatus(elements.oauthStatus, t('giffgaff.app.status.oauthOpened'), "success");
        } catch (error) {
            console.error('[Giffgaff] OAuth 登录失败:', error.message, error);
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
        const rawInput = elements.callbackUrl.value.trim();
        console.log('[Giffgaff] === OAuth 回调处理 ===');
        console.log('[Giffgaff] 原始输入长度:', rawInput.length);

        if (!rawInput) {
            console.warn('[Giffgaff] 回调URL为空');
            uiController.showStatus(elements.callbackStatus, tl('请输入回调URL'), "error");
            return;
        }

        // 自动提取回调URL
        const callbackUrl = this.extractCallbackUrl(rawInput);
        console.log('[Giffgaff] 回调URL提取完成, 长度:', callbackUrl.length);

        try {
            elements.processCallbackBtn.innerHTML = `<span class="loading"></span> ${tl('处理中...')}`;
            elements.processCallbackBtn.disabled = true;

            uiController.showStatus(elements.callbackStatus, t('giffgaff.app.status.oauthProcessing'), "success");

            console.log('[Giffgaff] 调用 oauthHandler.processCallback()...');
            const result = await oauthHandler.processCallback(callbackUrl);
            console.log('[Giffgaff] OAuth 回调处理成功, hasAccessToken:', !!result?.accessToken);

            uiController.showStatus(elements.callbackStatus, t('giffgaff.app.status.oauthSuccess'), "success");

            setTimeout(() => {
                uiController.showSection(2);
            }, 1500);
        } catch (error) {
            console.error('[Giffgaff] OAuth 回调处理失败:', error.message, error);
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
        console.log('[Giffgaff] === Cookie 验证开始 ===');

        // 检查服务时间
        if (!isServiceTimeAvailable()) {
            console.log('[Giffgaff] 服务时间外，显示警告');
            const shouldContinue = await showServiceTimeWarning();
            if (!shouldContinue) {
                console.log('[Giffgaff] 用户取消（服务时间外）');
                return;
            }
        }

        const cookie = elements.cookieInput.value.trim();
        console.log('[Giffgaff] Cookie输入长度:', cookie.length);
        if (!cookie) {
            console.warn('[Giffgaff] Cookie为空');
            uiController.showStatus(elements.cookieStatus, tl('请输入Cookie字符串'), "error");
            return;
        }

        try {
            elements.verifyCookieBtn.innerHTML = `<span class="loading"></span> ${tl('验证中...')}`;
            elements.verifyCookieBtn.disabled = true;

            uiController.showStatus(elements.cookieStatus, t('giffgaff.app.status.cookieVerifying'), "success");

            console.log('[Giffgaff] 调用 cookieHandler.verifyCookie()...');
            const result = await cookieHandler.verifyCookie(cookie);
            console.log('[Giffgaff] Cookie 验证结果:', JSON.stringify({ valid: result.valid, partialSuccess: result.partialSuccess }));

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
            console.error('[Giffgaff] Cookie 验证失败:', error.message, error);
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
        console.log('[Giffgaff] === MFA 验证码发送 ===');

        // 检查服务时间
        if (!isServiceTimeAvailable()) {
            console.log('[Giffgaff] 服务时间外，显示警告');
            const shouldContinue = await showServiceTimeWarning();
            if (!shouldContinue) {
                console.log('[Giffgaff] 用户取消（服务时间外）');
                return;
            }
        }

        try {
            elements.sendEmailBtn.innerHTML = `<span class="loading"></span> ${tl('发送中...')}`;
            elements.sendEmailBtn.disabled = true;

            uiController.showStatus(elements.emailStatus, t('giffgaff.app.status.mfaSending'), "success");

            const channelSelect = document.getElementById('mfaChannelSelect');
            const channel = channelSelect ? channelSelect.value : 'EMAIL';
            console.log('[Giffgaff] MFA 渠道:', channel);

            console.log('[Giffgaff] 调用 mfaHandler.sendMFAChallenge()...');
            await mfaHandler.sendMFAChallenge(channel);
            console.log('[Giffgaff] MFA 验证码发送成功');

            uiController.showStatus(elements.emailStatus, t('giffgaff.app.status.mfaSentSuccess'), "success");
            elements.emailVerificationSection.classList.add('active');
        } catch (error) {
            console.error('[Giffgaff] MFA 验证码发送失败:', error.message, error);
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
        console.log('[Giffgaff] === MFA 验证码校验 ===');

        if (!code) {
            console.warn('[Giffgaff] 验证码为空');
            uiController.showStatus(elements.emailVerifyStatus, tl('请输入验证码'), "error");
            return;
        }

        try {
            elements.verifyEmailBtn.innerHTML = `<span class="loading"></span> ${tl('验证中...')}`;
            elements.verifyEmailBtn.disabled = true;

            uiController.showStatus(elements.emailVerifyStatus, t('giffgaff.app.status.mfaVerifying'), "success");

            console.log('[Giffgaff] 调用 mfaHandler.validateMFACode()...');
            await mfaHandler.validateMFACode(code);
            console.log('[Giffgaff] MFA 验证成功');

            uiController.showStatus(elements.emailVerifyStatus, t('giffgaff.app.status.mfaVerifiedSuccess'), "success");

            setTimeout(() => {
                uiController.showSection(3);
            }, 1000);
        } catch (error) {
            console.error('[Giffgaff] MFA 验证失败:', error.message, error);
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
        console.log('[Giffgaff] === 获取会员信息 ===');

        try {
            elements.getMemberBtn.innerHTML = `<span class="loading"></span> ${tl('获取中...')}`;
            elements.getMemberBtn.disabled = true;

            uiController.showStatus(elements.memberStatus, t('giffgaff.app.status.memberFetching'), "success");

            console.log('[Giffgaff] 调用 esimService.getMemberInfo()...');
            const result = await esimService.getMemberInfo();
            console.log('[Giffgaff] 会员信息获取成功, memberId:', result.data?.memberProfile?.id);

            uiController.showStatus(elements.memberStatus, t('giffgaff.app.status.memberFetched'), "success");
            uiController.showMemberInfo(result.data);

            setTimeout(() => {
                uiController.showSection(4);
            }, 2000);
        } catch (error) {
            console.error('[Giffgaff] 获取会员信息失败:', error.message, error);

            // 针对"账号无号码"错误提供专门提示
            const isWalletEmpty = error.message?.includes('wallet must') ||
                                   error.message?.includes('at least one account') ||
                                   error.code === 4001;

            if (isWalletEmpty) {
                // 用户账号没有号码，不支持下一步操作
                const htmlMsg = `
                    <div style="text-align: left; line-height: 1.8;">
                        <p style="margin-bottom: 12px;"><strong>${tl('giffgaff.app.error.walletEmpty')}</strong></p>
                        <p style="margin-bottom: 8px;">${tl('giffgaff.app.error.walletEmptyDesc')}</p>
                        <ul style="margin-left: 20px; margin-bottom: 12px;">
                            <li>${tl('giffgaff.app.error.walletEmptyFeatures转换')}</li>
                            <li>${tl('giffgaff.app.error.walletEmptyFeatures更换')}</li>
                        </ul>
                        <p style="margin-bottom: 8px;">${tl('giffgaff.app.error.walletEmptyGuide')}</p>
                        <p style="margin-left: 20px;">
                            <a href="https://www.giffgaff.com/" target="_blank" rel="noopener noreferrer"
                               style="color: #2563eb; text-decoration: underline;">
                                ${tl('giffgaff.app.error.walletEmptyLink')} <i class="fas fa-external-link-alt" style="font-size: 0.85em;"></i>
                            </a>
                        </p>
                    </div>
                `;
                elements.memberStatus.innerHTML = htmlMsg;
                elements.memberStatus.className = 'status error';
            } else {
                uiController.showStatus(elements.memberStatus, t('giffgaff.app.error.memberFailed', { message: error.message }), "error");
            }
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
        console.log('[Giffgaff] === 预订 eSIM ===');

        // 检查服务时间
        if (!isServiceTimeAvailable()) {
            console.log('[Giffgaff] 服务时间外，显示警告');
            const shouldContinue = await showServiceTimeWarning();
            if (!shouldContinue) {
                console.log('[Giffgaff] 用户取消（服务时间外）');
                return;
            }
        }

        try {
            elements.reserveESimBtn.innerHTML = `<span class="loading"></span> ${tl('预订中...')}`;
            elements.reserveESimBtn.disabled = true;

            uiController.showStatus(elements.esimReserveStatus, t('giffgaff.app.status.reserveProcessing'), "success");

            console.log('[Giffgaff] 调用 esimService.reserveESim()...');
            const result = await esimService.reserveESim();
            console.log('[Giffgaff] eSIM 预订成功, deliveryStatus:', result.data?.esim?.deliveryStatus);

            const status = result.data.esim.deliveryStatus || 'RESERVED';
            uiController.showStatus(elements.esimReserveStatus, t('giffgaff.app.status.reserveSuccess', { status }), "success");

            // 显示eSIM信息和激活指导
            uiController.showESIMInfoAndGuide();
        } catch (error) {
            console.error('[Giffgaff] eSIM 预订失败:', error.message, error);
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
        console.log('[Giffgaff] === SMS 验证码发送 ===');

        try {
            sendBtn.innerHTML = `<span class="loading"></span> ${tl('发送中...')}`;
            sendBtn.disabled = true;

            uiController.showStatus(statusEl, t('giffgaff.app.status.smsSending'), 'success');

            console.log('[Giffgaff] 调用 mfaHandler.sendSimSwapMFAChallenge()...');
            await mfaHandler.sendSimSwapMFAChallenge();
            console.log('[Giffgaff] SMS 验证码发送成功');

            uiController.showStatus(statusEl, t('giffgaff.app.status.smsSentSuccess'), 'success');

            const codeSection = document.getElementById('smsCodeInputSection');
            if (codeSection) codeSection.style.display = 'block';
        } catch (error) {
            console.error('[Giffgaff] SMS 验证码发送失败:', error.message, error);
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
        console.log('[Giffgaff] === SMS 验证码校验 ===');

        const code = (codeInput?.value ?? '').trim();

        if (!/^\d{6}$/.test(code)) {
            console.warn('[Giffgaff] 验证码格式无效:', code.length, '位');
            uiController.showStatus(statusEl, tl('请输入6位数字验证码'), 'error');
            return;
        }

        try {
            verifyBtn.innerHTML = `<span class="loading"></span> ${tl('验证中...')}`;
            verifyBtn.disabled = true;

            uiController.showStatus(statusEl, t('giffgaff.app.status.smsVerifySuccess'), 'success');

            // 执行完整的SMS激活流程
            console.log('[Giffgaff] 调用 esimService.smsActivateFlow()...');
            await esimService.smsActivateFlow(code);
            console.log('[Giffgaff] SMS 激活流程完成');

            uiController.showSection(5);
            uiController.showESimResult();
        } catch (error) {
            console.error('[Giffgaff] SMS 激活流程失败:', error.message, error);

            // REF_REFRESHED_NEEDS_NEW_CODE: ref 过期，已自动重发新验证码
            if (error.code === 'REF_REFRESHED_NEEDS_NEW_CODE') {
                uiController.showStatus(statusEl, error.message, 'error');
                // 清空输入框并聚焦，引导用户输入新验证码
                if (codeInput) {
                    codeInput.value = '';
                    codeInput.focus();
                }
            } else {
                uiController.showStatus(
                    statusEl,
                    t('giffgaff.app.error.smsActivateFailed', { message: error.message }),
                    'error'
                );
            }
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

        const activationCode = (activationInput?.value ?? '').trim();
        const ssn = (ssnInput?.value ?? '').trim();
        console.log('[Giffgaff] === 手动 eSIM 信息保存 ===');
        console.log('[Giffgaff] 激活码长度:', activationCode.length, ', SSN长度:', ssn.length);

        if (!activationCode) {
            console.warn('[Giffgaff] 激活码为空');
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
     * 处理获取Token（issue #66: 增加前置校验 + 分类错误处理）
     */
    async handleGetToken() {
        const { elements } = uiController;
        const state = stateManager.getState();
        console.log('[Giffgaff] === 获取 eSIM Token ===');

        // === 前置校验：防止状态脱节导致的 422/401 错误 ===
        // trim 处理：防止空白字符串通过校验
        const esimSSN = typeof state.esimSSN === 'string' ? state.esimSSN.trim() : '';
        if (!esimSSN) {
            uiController.showStatus(elements.tokenStatus, t('giffgaff.app.error.missingSSN'), "error");
            console.error('[Giffgaff] Missing or invalid esimSSN. Redirecting to step 4.');
            setTimeout(() => uiController.showSection(4), 2000);
            return;
        }

        if (!state.accessToken || !state.emailSignature) {
            uiController.showStatus(elements.tokenStatus, t('giffgaff.app.error.sessionExpired'), "error");
            console.error('[Giffgaff] Missing auth tokens. Redirecting to login.');
            stateManager.clearSession();
            setTimeout(() => uiController.showSection(1), 2000);
            return;
        }

        console.log('[Giffgaff] SSN 长度:', esimSSN.length);

        const requestId = 'getToken_' + Date.now();

        try {
            this.activeRequests.add(requestId);
            elements.getESimTokenBtn.innerHTML = `<span class="loading"></span> ${tl('获取中...')}`;
            elements.getESimTokenBtn.disabled = true;

            uiController.showStatus(elements.tokenStatus, t('giffgaff.app.status.tokenFetching'), "success");

            console.log('[Giffgaff] 调用 esimService.getESimDownloadToken()...');
            const tokenResult = await esimService.getESimDownloadToken(esimSSN);

            // 用户已通过导航守卫离开当前步骤，忽略过期请求的结果
            if (!this.activeRequests.has(requestId)) return;

            // 确认请求仍有效后才写入状态，避免 stale 请求污染 session
            stateManager.set('lpaString', tokenResult.lpaString);

            console.log('[Giffgaff] eSIM Token 获取成功');

            this._beforeunloadExempt = true; // Token 已获取，解除 beforeunload 拦截
            uiController.showStatus(elements.tokenStatus, t('giffgaff.app.status.tokenFetchedSuccess'), "success");
            uiController.showESimResult();
        } catch (error) {
            // 用户已通过导航守卫离开当前步骤，忽略过期请求的错误
            if (!this.activeRequests.has(requestId)) return;

            console.error('[Giffgaff] eSIM Token 获取失败:', error.message, error);

            // 根据错误类型进行差异化处理
            if (error.status === 401 || error.message?.includes('401')) {
                uiController.showStatus(elements.tokenStatus, t('giffgaff.app.error.authExpired'), "error");
                setTimeout(() => {
                    if (confirm(t('giffgaff.app.prompt.relogin'))) {
                        stateManager.clearSession();
                        uiController.showSection(1);
                    }
                }, 500);
            } else if (error.status === 422 || error.message?.includes('422')) {
                uiController.showStatus(elements.tokenStatus, t('giffgaff.app.error.ssnNotFound'), "error");
                setTimeout(() => uiController.showSection(4), 2000);
            } else {
                // 其他错误：展示 esim-service 已转换的友好提示
                const errorMsg = error.message || t('giffgaff.app.error.tokenFailed', { message: '' });
                uiController.showStatus(elements.tokenStatus, errorMsg, "error");
            }
        } finally {
            this.activeRequests.delete(requestId);
            elements.getESimTokenBtn.innerHTML = `<i class="fas fa-download me-2"></i> ${tl('获取eSIM Token')}`;
            elements.getESimTokenBtn.disabled = false;
        }
    }

    /**
     * 处理清除会话
     */
    handleClearSession() {
        console.log('[Giffgaff] === 清除会话 ===');
        if (confirm(tl('确定要清除所有会话数据吗？这将重置所有进度。'))) {
            cookieHandler.stopValidityMonitor();
            stateManager.clearSession();
            this._beforeunloadExempt = false; // 重置 beforeunload 豁免
            console.log('[Giffgaff] 会话已清除');
            uiController.resetUI();
            uiController.showStatus(uiController.elements.loginMethodStatus, tl('会话已清除，请重新开始'), "success");
        } else {
            console.log('[Giffgaff] 用户取消清除会话');
        }
    }

    /**
     * 处理Cookie过期
     */
    handleCookieExpired(event) {
        console.log('[Giffgaff] === Cookie 已过期 ===', event?.detail);
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
     * 处理会话恢复（issue #66: 增加状态一致性降级）
     */
    handleSessionRestore() {
        const state = stateManager.getState();
        console.log('[Giffgaff] === 会话恢复 ===');
        console.log('[Giffgaff] 状态:', JSON.stringify({
            hasAccessToken: !!state.accessToken,
            hasEmailSignature: !!state.emailSignature,
            hasMemberId: !!state.memberId,
            hasEsimActivationCode: !!state.esimActivationCode,
            hasEsimSSN: !!state.esimSSN,
            hasLpaString: !!state.lpaString,
            currentStep: state.currentStep
        }));

        if (state.accessToken) {
            let targetStep = 1;

            if (state.emailSignature) {
                if (state.memberId && (state.esimActivationCode || state.esimSSN)) {
                    if (state.lpaString) {
                        targetStep = 5;
                        // LPA已获取，显示二维码和 LPA 信息（修复 Issue #75）
                        setTimeout(() => {
                            // 显示二维码和 LPA 字符串
                            console.log('[Giffgaff] 从 session 恢复 LPA，显示二维码和 LPA 信息');
                            uiController.showESimResult();

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

            // === 状态一致性降级：防止前后端状态脱节 ===
            if (targetStep === 5 && !state.esimSSN) {
                console.warn('[Giffgaff] State inconsistency: step 5 without SSN. Downgrading to step 4.');
                targetStep = 4;
            }
            if (targetStep === 4 && !state.memberId) {
                console.warn('[Giffgaff] State inconsistency: step 4 without memberId. Downgrading to step 3.');
                targetStep = 3;
            }

            // 使用降级后的 targetStep 作为事实来源，上方一致性校验已确保其有效
            uiController.showSection(targetStep);

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
        // 清理已存在的定时器
        this.clearTimers();

        this.checkServiceTime();
        this.updateLoginCardsState();

        // 启动倒计时定时器（每秒更新）
        this.startCountdownTimer();

        // 对齐到下一分钟整点
        const msToNextMinute = 60000 - (Date.now() % 60000);
        this.minuteTimeoutId = setTimeout(() => {
            this.checkServiceTime();
            this.updateLoginCardsState();
            this.minuteIntervalId = setInterval(() => {
                this.checkServiceTime();
                this.updateLoginCardsState();
            }, 60000);
        }, msToNextMinute);
    }

    /**
     * 清理所有定时器
     */
    clearTimers() {
        if (this.countdownIntervalId) {
            clearInterval(this.countdownIntervalId);
            this.countdownIntervalId = null;
        }
        if (this.minuteIntervalId) {
            clearInterval(this.minuteIntervalId);
            this.minuteIntervalId = null;
        }
        if (this.minuteTimeoutId) {
            clearTimeout(this.minuteTimeoutId);
            this.minuteTimeoutId = null;
        }
    }

    /**
     * 启动倒计时定时器
     */
    startCountdownTimer() {
        // 每秒更新倒计时显示
        this.countdownIntervalId = setInterval(() => {
            if (!isServiceTimeAvailable()) {
                this.updateCountdownDisplay();
            }
        }, 1000);
    }

    /**
     * 格式化倒计时文本
     * @param {Object} timeUntil - 包含 hours, minutes, seconds 的对象
     * @returns {string} 格式化后的倒计时文本
     */
    formatCountdownText(timeUntil) {
        if (!timeUntil) return '';

        const { hours, minutes, seconds } = timeUntil;
        const timeParts = [];

        if (hours > 0) {
            timeParts.push(`${hours}${tl('小时').replace('{count}', '')}`);
        }
        if (minutes > 0) {
            timeParts.push(`${minutes}${tl('分钟').replace('{count}', '')}`);
        }
        if (seconds > 0 || timeParts.length === 0) {
            timeParts.push(`${seconds}${tl('秒').replace('{count}', '')}`);
        }

        return `<br><strong style="color: #dc2626;">⏰ ${tl('距离开放还有')}${timeParts.join(' ')}</strong>`;
    }

    /**
     * 更新倒计时显示
     */
    updateCountdownDisplay() {
        const timeUntil = getTimeUntilServiceOpen();
        if (!timeUntil) return;

        const countdownText = this.formatCountdownText(timeUntil);
        const messageElement = document.getElementById('serviceTimeMessage');

        if (messageElement) {
            const baseText = t('giffgaff.app.service.outside');
            const newHTML = baseText + countdownText;

            // 只在内容变化时更新 DOM
            if (messageElement.innerHTML !== newHTML) {
                messageElement.innerHTML = newHTML;
            }
        }
    }

    /**
     * 更新登录卡片状态（禁用/启用）
     */
    updateLoginCardsState() {
        const isAvailable = isServiceTimeAvailable();
        const oauthCard = document.getElementById('oauthCard');
        const cookieCard = document.getElementById('cookieCard');

        // 更新卡片状态
        [oauthCard, cookieCard].forEach(card => {
            if (!card) return;

            if (isAvailable) {
                // 服务时间内：启用卡片
                card.classList.remove('disabled', 'service-time-disabled');
                card.style.cursor = 'pointer';
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';
                card.removeAttribute('aria-disabled');
                card.setAttribute('role', 'button');
                card.setAttribute('tabindex', '0');
            } else {
                // 服务时间外：禁用卡片
                card.classList.add('disabled', 'service-time-disabled');
                card.style.cursor = 'not-allowed';
                card.style.opacity = '0.5';
                card.style.pointerEvents = 'none';
                card.setAttribute('aria-disabled', 'true');
                card.removeAttribute('role');
                card.setAttribute('tabindex', '-1');
            }
        });
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

        if (!alertElement || !iconElement || !messageElement || !actionMessageElement) return;

        if (isOutside) {
            // 获取倒计时信息
            const timeUntil = getTimeUntilServiceOpen();
            const countdownText = this.formatCountdownText(timeUntil);

            alertElement.className = 'alert alert-warning mb-4';
            iconElement.className = 'fas fa-exclamation-triangle warning';
            messageElement.innerHTML = t('giffgaff.app.service.outside') + countdownText;
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
window.copyLPAString = copyLPAString;
window.downloadQRCode = downloadQRCode;

export default app;
