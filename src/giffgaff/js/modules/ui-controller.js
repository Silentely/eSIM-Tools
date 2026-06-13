/**
 * UI控制器模块
 * 负责UI状态更新、步骤切换、状态显示等
 */

import { stateManager } from './state-manager.js';
import { t, tl } from '../../../js/modules/i18n.js';
import { generateQRCodeWithFallback } from '../../../js/modules/qrcode-generator.js';

export class UIController {
    constructor() {
        this.elements = this.initElements();
        this.tooltips = new Map();
        this.qrTimeoutId = null; // 追踪二维码超时定时器（issue #66）
        this._qrGeneration = 0; // 防止并发 generateQRCode 竞态
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        return {
            steps: document.querySelectorAll('.step'),
            sections: document.querySelectorAll('.section'),

            // 状态显示元素
            statusMode: document.getElementById('statusMode'),
            statusAccessToken: document.getElementById('statusAccessToken'),
            statusMfaSignature: document.getElementById('statusMfaSignature'),
            statusMemberId: document.getElementById('statusMemberId'),
            statusEsimStatus: document.getElementById('statusEsimStatus'),
            statusActivationCode: document.getElementById('statusActivationCode'),
            statusLpaString: document.getElementById('statusLpaString'),
            clearSessionBtn: document.getElementById('clearSessionBtn'),
            modeBadge: document.getElementById('modeBadge'),

            // Step 1 - 登录方式选择
            loginMethodStatus: document.getElementById('loginMethodStatus'),
            oauthLoginSection: document.getElementById('oauthLoginSection'),
            cookieLoginSection: document.getElementById('cookieLoginSection'),

            // OAuth相关
            oauthLoginBtn: document.getElementById('oauthLoginBtn'),
            oauthStatus: document.getElementById('oauthStatus'),
            oauthCallbackSection: document.getElementById('oauthCallbackSection'),
            callbackUrl: document.getElementById('callbackUrl'),
            processCallbackBtn: document.getElementById('processCallbackBtn'),
            callbackStatus: document.getElementById('callbackStatus'),

            // Cookie相关
            cookieInput: document.getElementById('cookieInput'),
            verifyCookieBtn: document.getElementById('verifyCookieBtn'),
            cookieStatus: document.getElementById('cookieStatus'),

            // Step 2 - Email verification
            sendEmailBtn: document.getElementById('sendEmailBtn'),
            emailStatus: document.getElementById('emailStatus'),
            emailVerificationSection: document.getElementById('emailVerificationSection'),
            emailCode: document.getElementById('emailCode'),
            verifyEmailBtn: document.getElementById('verifyEmailBtn'),
            emailVerifyStatus: document.getElementById('emailVerifyStatus'),

            // Step 3 - Member info
            getMemberBtn: document.getElementById('getMemberBtn'),
            memberStatus: document.getElementById('memberStatus'),
            memberInfo: document.getElementById('memberInfo'),

            // Step 4 - eSIM reservation
            reserveESimBtn: document.getElementById('reserveESimBtn'),
            esimReserveStatus: document.getElementById('esimReserveStatus'),

            // Step 5 - Get eSIM token and QR
            getESimTokenBtn: document.getElementById('getESimTokenBtn'),
            tokenStatus: document.getElementById('tokenStatus'),
            resultContainer: document.getElementById('resultContainer'),
            qrcode: document.getElementById('qrcode'),
            esimInfo: document.getElementById('esimInfo'),

            // Auto activation
            autoActivateBtn: document.getElementById('autoActivateBtn'),
            autoActivateStatus: document.getElementById('autoActivateStatus')
        };
    }

    /**
     * 显示状态消息
     */
    showStatus(element, message, type) {
        if (!element) return;
        element.textContent = message;
        element.className = `status active ${type}`;
        element.setAttribute('role', type === 'error' ? 'alert' : 'status');
        element.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * 更新步骤指示器
     */
    updateSteps(currentStep) {
        this.elements.steps.forEach((step, index) => {
            const stepNo = index + 1;
            if (stepNo <= currentStep) {
                step.classList.add('active');
                step.style.cursor = 'pointer';
                step.title = stepNo < currentStep ? tl('点击返回此步骤') : '';
            } else {
                step.classList.remove('active');
                step.style.cursor = 'not-allowed';
                step.title = tl('请按顺序完成前序步骤');
            }
        });
    }

    /**
     * 显示指定步骤（issue #66: Step 4/5 添加刷新警告）
     */
    showSection(stepNumber) {
        this.elements.sections.forEach((section, index) => {
            if (index === stepNumber - 1) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });

        // 进入第2步时重置验证码UI
        if (stepNumber === 2) {
            if (this.elements.emailStatus) {
                this.elements.emailStatus.textContent = '';
                this.elements.emailStatus.className = 'status';
            }
            if (this.elements.emailVerificationSection) {
                this.elements.emailVerificationSection.classList.remove('active');
            }
            const codeInput = document.getElementById('emailCode');
            if (codeInput) codeInput.value = '';
        }

        // Step 4/5: 显示刷新警告提示（防止用户误操作导致状态脱节）
        this._showCriticalStepWarning(stepNumber);

        stateManager.set('currentStep', stepNumber);
        this.updateSteps(stepNumber);
    }

    /**
     * 显示关键步骤的刷新警告（issue #66）
     * @param {number} stepNumber - 步骤编号
     */
    _showCriticalStepWarning(stepNumber) {
        // 移除所有已存在的警告
        document.querySelectorAll('.critical-step-warning').forEach(el => el.remove());

        // Step 4 和 Step 5 显示警告
        if (stepNumber === 4 || stepNumber === 5) {
            const section = this.elements.sections[stepNumber - 1];
            if (!section) return;

            const warningEl = document.createElement('div');
            warningEl.className = 'alert alert-warning mt-2 mb-3 critical-step-warning';
            warningEl.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${t('giffgaff.app.warning.criticalStep')}`;
            warningEl.style.cssText = 'font-weight: 500; border-left: 4px solid #f59e0b;';

            // 插入到 section 内容的最前面
            const firstChild = section.querySelector('.section-content, .card, .mb-3, h3, h4, h5');
            if (firstChild) {
                section.insertBefore(warningEl, firstChild);
            } else {
                section.prepend(warningEl);
            }
        }
    }

    /**
     * 选择登录方式
     */
    selectLoginMethod(method) {
        if (method === 'oauth') {
            this.elements.oauthLoginSection.style.display = 'block';
            this.elements.cookieLoginSection.style.display = 'none';
            this.showStatus(this.elements.loginMethodStatus, tl('已选择OAuth 2.0登录方式'), "success");
        } else if (method === 'cookie') {
            this.elements.oauthLoginSection.style.display = 'none';
            this.elements.cookieLoginSection.style.display = 'block';
            this.showStatus(this.elements.loginMethodStatus, tl('已选择Cookie登录方式'), "success");
        }
    }

    /**
     * 更新状态面板显示
     */
    updateStatusPanel() {
        const state = stateManager.getState();

        // 模式显示
        if (this.elements.statusMode) {
            if (state.directFetchMode) {
                this.elements.statusMode.textContent = tl('已付款用户直取 eSIM');
                this.elements.statusMode.className = 'status-value connected';
            } else if (state.isDeviceChange) {
                this.elements.statusMode.textContent = tl('设备更换');
                this.elements.statusMode.className = 'status-value connected';
            } else {
                this.elements.statusMode.textContent = tl('标准流程');
                this.elements.statusMode.className = 'status-value connected';
            }
        }

        if (this.elements.modeBadge) {
            this.elements.modeBadge.style.display =
                state.isDeviceChange && !state.directFetchMode ? 'inline-flex' : 'none';
        }

        // Access Token
        if (state.accessToken) {
            this.elements.statusAccessToken.textContent = state.accessToken;
            this.elements.statusAccessToken.className = 'status-value connected';
            this.addTooltip(this.elements.statusAccessToken, state.accessToken);
        } else {
            this.elements.statusAccessToken.textContent = tl('未登录');
            this.elements.statusAccessToken.className = 'status-value disconnected';
            this.removeTooltip(this.elements.statusAccessToken);
        }

        // MFA签名
        if (state.emailSignature) {
            this.elements.statusMfaSignature.textContent = state.emailSignature;
            this.elements.statusMfaSignature.className = 'status-value connected';
            this.addTooltip(this.elements.statusMfaSignature, state.emailSignature, true);
        } else {
            this.elements.statusMfaSignature.textContent = tl('未验证');
            this.elements.statusMfaSignature.className = 'status-value disconnected';
            this.removeTooltip(this.elements.statusMfaSignature);
        }

        // 会员ID
        if (state.memberId) {
            this.elements.statusMemberId.textContent = state.memberId;
            this.elements.statusMemberId.className = 'status-value connected';
            this.addTooltip(this.elements.statusMemberId, state.memberId);
        } else {
            this.elements.statusMemberId.textContent = tl('未获取');
            this.elements.statusMemberId.className = 'status-value disconnected';
            this.removeTooltip(this.elements.statusMemberId);
        }

        // eSIM状态
        const hasPrerequisite = !!state.memberId;
        const delivery = hasPrerequisite
            ? (state.esimDeliveryStatus || (state.esimActivationCode ? 'RESERVED' : tl('未处理')))
            : tl('未处理');
        const phoneSuffix = state.phoneNumber ? `/${state.phoneNumber}` : '';
        const esimStatusText = (hasPrerequisite && delivery && delivery !== tl('未处理'))
            ? `${delivery}${phoneSuffix}`
            : tl('未处理');

        this.elements.statusEsimStatus.textContent = esimStatusText;
        this.elements.statusEsimStatus.className = (hasPrerequisite && delivery && delivery !== tl('未处理'))
            ? 'status-value connected'
            : 'status-value disconnected';

        if (hasPrerequisite && delivery && delivery !== tl('未处理')) {
            this.addTooltip(this.elements.statusEsimStatus, esimStatusText);
        } else {
            this.removeTooltip(this.elements.statusEsimStatus);
        }

        // 激活码
        if (state.memberId && state.esimActivationCode) {
            const text = state.esimSSN
                ? `${state.esimActivationCode}/${state.esimSSN}`
                : state.esimActivationCode;
            this.elements.statusActivationCode.textContent = text;
            this.elements.statusActivationCode.className = 'status-value connected';
            this.addTooltip(this.elements.statusActivationCode, text);
        } else {
            this.elements.statusActivationCode.textContent = tl('未获取');
            this.elements.statusActivationCode.className = 'status-value disconnected';
            this.removeTooltip(this.elements.statusActivationCode);
        }

        // LPA字符串
        if (state.lpaString) {
            this.elements.statusLpaString.textContent = tl('已获取');
            this.elements.statusLpaString.className = 'status-value connected';
            this.removeTooltip(this.elements.statusLpaString);
        } else {
            this.elements.statusLpaString.textContent = tl('未生成');
            this.elements.statusLpaString.className = 'status-value disconnected';
            this.removeTooltip(this.elements.statusLpaString);
        }
    }

    /**
     * 添加Tooltip
     */
    addTooltip(element, fullText, forceShow = false) {
        if (!element || !fullText) return;

        const isTruncated = element.scrollWidth > element.clientWidth;
        if (!forceShow && !isTruncated) return;

        this.removeTooltip(element);

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = fullText;
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-hidden', 'true');

        const onEnter = (e) => this.showTooltipElement(tooltip, e);
        const onLeave = () => this.hideTooltipElement(tooltip);

        element.addEventListener('mouseenter', onEnter);
        element.addEventListener('mouseleave', onLeave);
        element.style.cursor = 'help';

        this.tooltips.set(element, { tooltip, onEnter, onLeave });
    }

    /**
     * 移除Tooltip
     */
    removeTooltip(element) {
        const data = this.tooltips.get(element);
        if (data) {
            element.removeEventListener('mouseenter', data.onEnter);
            element.removeEventListener('mouseleave', data.onLeave);
            if (data.tooltip.parentNode) {
                data.tooltip.parentNode.removeChild(data.tooltip);
            }
            this.tooltips.delete(element);
        }
        element.style.cursor = 'default';
    }

    /**
     * 显示Tooltip元素
     */
    showTooltipElement(tooltip, event) {
        if (!tooltip) return;

        document.body.appendChild(tooltip);

        const rect = event.target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.bottom + 4;

        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';

        setTimeout(() => {
            tooltip.classList.add('show');
        }, 100);
    }

    /**
     * 隐藏Tooltip元素
     */
    hideTooltipElement(tooltip) {
        if (!tooltip) return;
        tooltip.classList.remove('show');
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 300);
    }

    /**
     * 显示会员信息
     */
    showMemberInfo(memberData) {
        const state = stateManager.getState();
        this.elements.memberInfo.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">${tl('会员信息')}</h5>
                    <p><strong>${tl('会员ID:')}</strong> ${state.memberId}</p>
                    <p><strong>${tl('会员姓名:')}</strong> ${state.memberName}</p>
                    <p><strong>${tl('手机号码:')}</strong> ${state.phoneNumber}</p>
                    <p><strong>${tl('SIM状态:')}</strong> ${memberData.sim.status}</p>
                </div>
            </div>
        `;
    }

    /**
     * 显示eSIM信息和激活指导
     */
    showESIMInfoAndGuide() {
        const state = stateManager.getState();
        const esimInfoDisplay = document.getElementById('esimInfoDisplay');
        const displayActivationCode = document.getElementById('displayActivationCode');
        const displaySSN = document.getElementById('displaySSN');
        const esimStatusTitle = document.getElementById('esimStatusTitle');

        if (esimInfoDisplay && displayActivationCode && displaySSN) {
            displayActivationCode.textContent = state.esimActivationCode || tl('未获取');
            displaySSN.textContent = state.esimSSN || tl('未获取');

            if (esimStatusTitle) {
                const deliveryStatus = state.esimDeliveryStatus || 'RESERVED';
                esimStatusTitle.textContent = tl('您的eSIM信息（状态：{status}）', { status: deliveryStatus });
            }

            esimInfoDisplay.style.display = 'block';
        }
    }

    /**
     * 生成二维码（本地生成优先，后端 Function 降级）
     */
    async generateQRCode(data) {
        const size = 300;

        // 清除旧的超时定时器，避免历史调用覆盖当前二维码区域。
        if (this.qrTimeoutId) {
            clearTimeout(this.qrTimeoutId);
            this.qrTimeoutId = null;
        }

        const gen = ++this._qrGeneration;

        try {
            const labels = {
                alt: tl('eSIM 二维码'),
                ariaLabel: tl('eSIM 安装二维码'),
                tooltipAlt: tl('eSIM 二维码放大预览')
            };

            const result = await generateQRCodeWithFallback(data, size, labels);
            if (gen !== this._qrGeneration) return; // 防止并发调用干扰

            if (result.tooltip && typeof this.showTooltipElement === 'function' && typeof this.hideTooltipElement === 'function') {
                result.container.addEventListener('mouseenter', (event) => this.showTooltipElement(result.tooltip, event));
                result.container.addEventListener('mouseleave', () => this.hideTooltipElement(result.tooltip));
            }

            this.elements.qrcode.innerHTML = '';
            this.elements.qrcode.appendChild(result.container);
        } catch (error) {
            if (gen !== this._qrGeneration) return;
            console.error('[Giffgaff] QR code generation failed:', error);

            // 使用 DOM API 创建元素，避免 innerHTML XSS 风险
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger';

            const icon = document.createElement('i');
            icon.className = 'fas fa-exclamation-circle me-2';
            alertDiv.appendChild(icon);

            const message = document.createTextNode(t('giffgaff.app.qr.failed'));
            alertDiv.appendChild(message);

            this.elements.qrcode.innerHTML = '';
            this.elements.qrcode.appendChild(alertDiv);
        }
    }

    /**
     * 显示eSIM结果
     */
    showESimResult() {
        const state = stateManager.getState();

        try {
            // 防御性检查：即使 lpaString 为空也显示容器，给用户明确提示（修复 Issue #75）
            this.elements.resultContainer.classList.add('active');

            if (!state.lpaString) {
                // LPA 字符串缺失，显示错误提示和调试信息
                console.error('[Giffgaff] showESimResult called but lpaString is empty');
                this.elements.qrcode.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        ${t('giffgaff.app.error.lpaStringMissing') || '获取 LPA 字符串失败'}
                    </div>
                `;
                this.elements.esimInfo.innerHTML = `
                    <div class="alert alert-warning">
                        <p><strong>${tl('可能原因')}：</strong></p>
                        <ul class="mb-0">
                            <li>后端轮询超时或失败</li>
                            <li>GraphQL 响应异常</li>
                            <li>网络连接中断</li>
                            <li>eSIM 状态异常</li>
                        </ul>
                        <hr class="my-2">
                        <p class="mb-0">
                            <small>
                                ${tl('请打开浏览器控制台（F12）查看详细日志')}
                                <br>
                                <a href="https://github.com/Silentely/eSIM-Tools/issues" target="_blank" rel="noopener noreferrer">
                                    ${tl('提交问题反馈')} <i class="fas fa-external-link-alt"></i>
                                </a>
                            </small>
                        </p>
                    </div>
                `;
                return;
            }

            // 验证 DOM 元素存在
            if (!this.elements.qrcode || !this.elements.esimInfo) {
                console.error('[Giffgaff] DOM elements not found: qrcode or esimInfo');
                return;
            }

            console.log('[Giffgaff] Displaying eSIM result, LPA length:', state.lpaString.length);

            // 正常流程：先显示 LPA 信息（确保用户至少能看到文本），再生成二维码
            // 调整顺序：LPA 文本优先，二维码可以慢慢加载
            this.elements.esimInfo.innerHTML = `
            <div class="mb-3">
                <h5 class="text-primary">${tl('LPA字符串')}</h5>
                <p class="text-break"><small>${state.lpaString}</small></p>
            </div>
            <div class="btn-group mt-3 w-100">
                <button id="copyLpaBtn" class="btn btn-outline-dark">
                    <i class="fas fa-copy me-2"></i>${tl('复制 LPA 字符串')}
                </button>
                <button id="downloadQrBtn" class="btn btn-primary">
                    <i class="fas fa-download me-2"></i>${tl('下载二维码')}
                </button>
            </div>
            <div class="alert alert-warning mt-3">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${tl('请立即保存这些信息，页面关闭后将无法再次查看！')}
            </div>
        `;

            // 绑定按钮事件
            const copyBtn = document.getElementById('copyLpaBtn');
            const downloadBtn = document.getElementById('downloadQrBtn');

            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    if (window.copyLPAString) {
                        window.copyLPAString(state.lpaString, copyBtn);
                    }
                });
            }

            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    const img = this.elements.qrcode.querySelector('img');
                    if (img && window.downloadQRCode) {
                        window.downloadQRCode(img.src, 'giffgaff_esim_qrcode.png');
                    }
                });
            }

            // 生成二维码（放在最后，即使失败也不影响 LPA 文本显示）
            try {
                this.generateQRCode(state.lpaString);
            } catch (error) {
                console.error('[Giffgaff] generateQRCode failed:', error);
                this.elements.qrcode.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        二维码生成失败，请使用上方 LPA 字符串手动激活
                    </div>
                `;
            }

            setTimeout(() => {
                this.elements.resultContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
        } catch (error) {
            // 最外层错误捕获：确保即使出现未预期异常，用户也能看到错误提示
            console.error('[Giffgaff] showESimResult failed:', error);
            this.elements.qrcode.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    显示 eSIM 信息时发生错误
                </div>
            `;
            this.elements.esimInfo.innerHTML = `
                <div class="alert alert-warning">
                    <p><strong>错误详情：</strong> ${error.message}</p>
                    <p class="mb-0">
                        <small>
                            请刷新页面重试，或按 F12 → Application → Session Storage → giffgaff_session 手动获取 lpaString
                        </small>
                    </p>
                </div>
            `;
        }
    }

    /**
     * 下载二维码
     */
    downloadQRCode() {
        const img = this.elements.qrcode.querySelector('img');
        if (!img) return;

        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'giffgaff_esim_qrcode.png';
        link.click();
    }

    /**
     * 重置UI
     */
    resetUI() {
        // 重置所有表单
        document.querySelectorAll('input').forEach(input => {
            if (input.type !== 'radio' && input.type !== 'checkbox') {
                input.value = '';
            }
        });

        // 重置所有状态显示
        document.querySelectorAll('.status').forEach(status => {
            status.innerHTML = '';
            status.className = 'status';
        });

        // 清除会员信息和eSIM信息等动态内容区
        if (this.elements.memberInfo) this.elements.memberInfo.innerHTML = '';
        const esimInfoDisplay = document.getElementById('esimInfoDisplay');
        if (esimInfoDisplay) esimInfoDisplay.style.display = 'none';
        const resultContainer = this.elements.resultContainer;
        if (resultContainer) resultContainer.innerHTML = '';

        // 重置按钮状态
        document.querySelectorAll('button').forEach(btn => {
            if (!btn.id.includes('clearSession') && !btn.onclick) {
                btn.disabled = false;
            }
        });

        this.showSection(1);
        this.updateSteps(1);
    }
}

// 创建单例实例
export const uiController = new UIController();
