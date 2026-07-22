/**
 * Simyo UI控制器模块
 * 负责UI状态更新、步骤切换、状态显示等
 */

import { stateManager } from './state-manager.js';
import { t, tl } from '../../../js/modules/i18n.js';
import { generateQRCodeWithFallback } from '../../../js/modules/qrcode-generator.js';

export class UIController {
    constructor() {
        this.tooltips = new Map();
        this._elementsCache = null;
        this._qrGeneration = 0; // 生成计数器，防止并发干扰
    }

    /**
     * 获取元素引用（延迟初始化）
     */
    get elements() {
        if (!this._elementsCache) {
            this._elementsCache = this.initElements();
        }
        return this._elementsCache;
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        return {
            // 仅选择进度条内的步骤，避免与其它 .step 类名冲突
            steps: document.querySelectorAll('.step-indicator .step'),
            sections: document.querySelectorAll('.section'),

            // 状态显示元素
            statusMode: document.getElementById('statusMode'),
            statusSessionToken: document.getElementById('statusSessionToken'),
            statusValidationCode: document.getElementById('statusValidationCode'),
            statusEsimStatus: document.getElementById('statusEsimStatus'),
            statusActivationCode: document.getElementById('statusActivationCode'),
            statusLpaString: document.getElementById('statusLpaString'),
            clearSessionBtn: document.getElementById('clearSessionBtn'),
            modeBadge: document.getElementById('modeBadge'),

            // Step 1 - Login
            phoneNumber: document.getElementById('phoneNumber'),
            password: document.getElementById('password'),
            loginBtn: document.getElementById('loginBtn'),
            loginStatus: document.getElementById('loginStatus'),

            // Step 2 - Login MFA
            stepMfa: document.getElementById('stepMfa'),
            mfaOtpInput: document.getElementById('mfaOtpInput'),
            verifyMfaBtn: document.getElementById('verifyMfaBtn'),
            mfaStatus: document.getElementById('mfaStatus'),
            mfaHintText: document.getElementById('mfaHintText'),

            // 设备更换流程
            deviceChangeSteps: document.getElementById('deviceChangeSteps'),

            // Step 3 - Get eSIM（DOM id 仍为 step2）
            getEsimBtn: document.getElementById('getEsimBtn'),
            esimStatus: document.getElementById('esimStatus'),
            esimInfo: document.getElementById('esimInfo'),

            // Step 4 - Generate QR（DOM id 仍为 step3）
            generateQrBtn: document.getElementById('generateQrBtn'),
            qrStatus: document.getElementById('qrStatus'),
            resultContainer: document.getElementById('resultContainer'),
            qrcode: document.getElementById('qrcode'),
            activationInfo: document.getElementById('activationInfo'),

            // Step 5 - Confirm Install（DOM id 仍为 step4）
            confirmInstallBtn: document.getElementById('confirmInstallBtn'),
            confirmStatus: document.getElementById('confirmStatus')
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
        const steps = this.elements.steps;
        const total = steps.length;

        steps.forEach((step, index) => {
            const stepNo = index + 1;
            step.classList.remove('active', 'completed');

            if (stepNo < currentStep) {
                step.classList.add('completed');
                step.style.cursor = 'pointer';
                step.title = tl('点击返回此步骤');
                step.setAttribute('aria-current', 'false');
            } else if (stepNo === currentStep) {
                step.classList.add('active');
                step.style.cursor = 'pointer';
                step.title = '';
                step.setAttribute('aria-current', 'step');
            } else {
                step.style.cursor = 'not-allowed';
                step.title = tl('请按顺序完成前序步骤');
                step.setAttribute('aria-current', 'false');
            }
        });

        // 进度轨：已完成区间占比（1 步时为 0，末步为 1）
        const indicator = steps[0] && steps[0].closest
            ? steps[0].closest('.step-indicator')
            : null;
        if (indicator && total > 1) {
            const progress = Math.max(0, Math.min(1, (currentStep - 1) / (total - 1)));
            indicator.style.setProperty('--step-progress', String(progress));
        } else if (indicator) {
            indicator.style.setProperty('--step-progress', currentStep > 0 ? '1' : '0');
        }
    }

    /**
     * 隐藏所有主流程 section（含 MFA、设备更换）
     */
    hideAllWorkflowSections() {
        const ids = ['step1', 'stepMfa', 'step2', 'step3', 'step4', 'deviceChangeSteps'];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('active');
                el.style.display = 'none';
            }
        });
    }

    /**
     * 显示指定主步骤
     * 1=登录 2=登录MFA 3=获取eSIM 4=生成二维码 5=确认安装
     * （DOM：step1 / stepMfa / step2 / step3 / step4）
     */
    showSection(stepNumber) {
        this.hideAllWorkflowSections();

        const map = {
            1: 'step1',
            2: 'stepMfa',
            3: 'step2',
            4: 'step3',
            5: 'step4'
        };
        const targetId = map[stepNumber] || 'step1';
        const target = document.getElementById(targetId);
        if (target) {
            target.classList.add('active');
            target.style.display = 'block';
        }

        stateManager.set('currentStep', stepNumber);
        this.updateSteps(stepNumber);
    }

    /**
     * 显示登录 MFA 步骤，并填充发送渠道提示
     * @param {{methodHint?:string, mfaMethod?:string}} [info]
     */
    showMfaStep(info = {}) {
        this.hideAllWorkflowSections();
        const stepMfa = document.getElementById('stepMfa');
        if (stepMfa) {
            stepMfa.classList.add('active');
            stepMfa.style.display = 'block';
        }

        const hintEl = document.getElementById('mfaHintText');
        if (hintEl) {
            const hint = info.methodHint || info.mfaMethod || '';
            hintEl.textContent = hint
                ? t('simyo.auth.mfaHintLine', { hint })
                : t('simyo.auth.mfaHintFallback');
        }

        const otpInput = document.getElementById('mfaOtpInput');
        if (otpInput) {
            otpInput.value = '';
            otpInput.focus();
        }
        const verifyBtn = document.getElementById('verifyMfaBtn');
        if (verifyBtn) {
            verifyBtn.disabled = true;
        }

        stateManager.set('currentStep', 2);
        this.updateSteps(2);
    }

    /**
     * 显示设备更换步骤
     * - 未开 MFA 的老用户：登录成功后直接进入
     * - 已开 MFA：verifyOTP 成功后再进入（跳过空的步骤 2 展示）
     */
    showDeviceChangeSteps() {
        this.hideAllWorkflowSections();

        const deviceChangeSteps = document.getElementById('deviceChangeSteps');
        if (deviceChangeSteps) {
            deviceChangeSteps.classList.add('active');
            deviceChangeSteps.style.display = 'block';
        } else {
            console.error('deviceChangeSteps 元素未找到！');
        }

        // 进度条：步骤 2（登录验证）对未开 MFA 用户视为已跳过，落在步骤 3 业务区
        stateManager.setState({ isDeviceChange: true, currentStep: 3 });
        this.updateSteps(3);
    }

    /**
     * 跳过设备更换，进入获取 eSIM（步骤 3）
     */
    skipDeviceChange() {
        this.hideAllWorkflowSections();
        stateManager.setState({ isDeviceChange: false });
        this.showSection(3);
    }

    /**
     * 更新状态面板显示
     */
    updateStatusPanel() {
        const state = stateManager.getState();

        // 模式显示
        if (this.elements.statusMode) {
            if (state.isDeviceChange) {
                this.elements.statusMode.textContent = tl('设备更换');
                this.elements.statusMode.className = 'status-value connected';
            } else {
                this.elements.statusMode.textContent = tl('标准流程');
                this.elements.statusMode.className = 'status-value connected';
            }
        }

        if (this.elements.modeBadge) {
            this.elements.modeBadge.style.display = state.isDeviceChange ? 'inline-flex' : 'none';
        }

        // Session Token（MFA 待验证时仅临时会话，不显示为已登录）
        if (state.sessionToken && !state.mfaPending) {
            this.elements.statusSessionToken.textContent = state.sessionToken;
            this.elements.statusSessionToken.className = 'status-value connected';
            this.addTooltip(this.elements.statusSessionToken, state.sessionToken);
        } else if (state.mfaPending) {
            this.elements.statusSessionToken.textContent = tl('待验证');
            this.elements.statusSessionToken.className = 'status-value disconnected';
            this.removeTooltip(this.elements.statusSessionToken);
        } else {
            this.elements.statusSessionToken.textContent = tl('未登录');
            this.elements.statusSessionToken.className = 'status-value disconnected';
            this.removeTooltip(this.elements.statusSessionToken);
        }

        // 验证码状态
        if (state.validationCode) {
            this.elements.statusValidationCode.textContent = tl('已发送');
            this.elements.statusValidationCode.className = 'status-value connected';
        } else {
            this.elements.statusValidationCode.textContent = tl('未发送');
            this.elements.statusValidationCode.className = 'status-value disconnected';
        }

        // eSIM状态
        if (state.activationCode) {
            this.elements.statusEsimStatus.textContent = tl('已处理');
            this.elements.statusEsimStatus.className = 'status-value connected';
        } else {
            this.elements.statusEsimStatus.textContent = tl('未处理');
            this.elements.statusEsimStatus.className = 'status-value disconnected';
        }

        // 激活码
        if (state.activationCode) {
            this.elements.statusActivationCode.textContent = state.activationCode;
            this.elements.statusActivationCode.className = 'status-value connected';
            this.addTooltip(this.elements.statusActivationCode, state.activationCode);
        } else {
            this.elements.statusActivationCode.textContent = tl('未获取');
            this.elements.statusActivationCode.className = 'status-value disconnected';
            this.removeTooltip(this.elements.statusActivationCode);
        }

        // LPA字符串
        if (state.activationCode) {
            this.elements.statusLpaString.textContent = tl('已获取');
            this.elements.statusLpaString.className = 'status-value connected';
        } else {
            this.elements.statusLpaString.textContent = tl('未生成');
            this.elements.statusLpaString.className = 'status-value disconnected';
        }
    }

    /**
     * 添加Tooltip
     */
    addTooltip(element, fullText) {
        if (!element || !fullText) return;

        const isTruncated = element.scrollWidth > element.clientWidth;
        if (!isTruncated) return;

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
        if (element) element.style.cursor = 'default';
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
     * 生成二维码（本地生成优先，后端 Function 降级）
     */
    async generateQRCode(data) {
        const size = 300;
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
            console.error('[Simyo] QR code generation failed:', error);

            // 使用 DOM API 创建元素，避免 innerHTML XSS 风险
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger';

            const icon = document.createElement('i');
            icon.className = 'fas fa-exclamation-circle me-2';
            alertDiv.appendChild(icon);

            const message = document.createTextNode(t('simyo.app.qr.failed'));
            alertDiv.appendChild(message);

            this.elements.qrcode.innerHTML = '';
            this.elements.qrcode.appendChild(alertDiv);
        }
    }

    /**
     * 显示eSIM信息
     */
    showEsimInfo(esimData) {
        // 优先当前缓存；重复 id 清理后唯一挂载在二维码步骤
        const host = this.elements.esimInfo || document.getElementById('esimInfo');
        if (!host || !esimData) {
            return;
        }
        host.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">${tl('eSIM信息')}</h5>
                    <p><strong>${tl('激活码:')}</strong> <span class="text-break">${esimData.activationCode}</span></p>
                    <p><strong>${tl('状态:')}</strong> ${esimData.status || tl('准备就绪')}</p>
                    ${esimData.phoneNumber ? `<p><strong>${tl('关联号码:')}</strong> ${esimData.phoneNumber}</p>` : ''}
                    ${esimData.iccid ? `<p><strong>ICCID:</strong> ${esimData.iccid}</p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * 显示二维码结果
     */
    showQRResult(lpaString) {
        this.elements.resultContainer.style.display = 'block';
        this.elements.resultContainer.classList.add('active');

        // 清空旧二维码容器，防止异步生成期间显示过期内容
        this.elements.qrcode.replaceChildren();
        // generateQRCode 内部已处理所有错误，无需外部 .catch()
        this.generateQRCode(lpaString);

        this.elements.activationInfo.innerHTML = `
            <div class="mb-3">
                <h5 class="text-primary">${tl('LPA激活码')}</h5>
                <p class="text-break"><small>${lpaString}</small></p>
            </div>
            <div class="btn-group mt-3 w-100">
                <button id="copyLpaBtn" class="btn btn-base btn-dark-gradient">
                    <i class="fas fa-copy me-2"></i>${tl('复制激活码')}
                </button>
                <button id="downloadQrBtn" class="btn btn-base btn-primary-gradient">
                    <i class="fas fa-download me-2"></i>${tl('下载二维码')}
                </button>
            </div>
            <div class="alert alert-info mt-3">
                <i class="fas fa-mobile-alt me-2"></i>
                <strong>${tl('使用说明：')}</strong>${tl('在支持eSIM的设备上扫描此二维码进行安装，或手动输入LPA激活码')}
            </div>
        `;
    }

    /**
     * 下载二维码
     */
    downloadQRCode() {
        const img = this.elements.qrcode.querySelector('img');
        if (!img) return;

        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'simyo_esim_qrcode.png';
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

        // 重置按钮状态
        document.querySelectorAll('button').forEach(btn => {
            if (!btn.id.includes('clearSession')) {
                btn.disabled = false;
            }
        });

        // 隐藏 MFA / 设备更换 / 后续步骤，回到登录
        this.hideAllWorkflowSections();
        this.showSection(1);
        this.updateSteps(1);
    }
}

// 创建单例实例
export const uiController = new UIController();
