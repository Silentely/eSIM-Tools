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
            steps: document.querySelectorAll('.step'),
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

            // 设备更换流程
            deviceChangeSteps: document.getElementById('deviceChangeSteps'),

            // Step 2 - Get eSIM
            getEsimBtn: document.getElementById('getEsimBtn'),
            esimStatus: document.getElementById('esimStatus'),
            esimInfo: document.getElementById('esimInfo'),

            // Step 3 - Generate QR
            generateQrBtn: document.getElementById('generateQrBtn'),
            qrStatus: document.getElementById('qrStatus'),
            resultContainer: document.getElementById('resultContainer'),
            qrcode: document.getElementById('qrcode'),
            activationInfo: document.getElementById('activationInfo'),

            // Step 4 - Confirm Install
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
     * 显示指定步骤
     */
    showSection(stepNumber) {
        // 直接通过 ID 获取主要步骤元素，避免 index 混淆
        const step1 = document.getElementById('step1');
        const step2 = document.getElementById('step2');
        const step3 = document.getElementById('step3');
        const step4 = document.getElementById('step4');

        const steps = [step1, step2, step3, step4];

        // 隐藏所有主要步骤
        steps.forEach((step, index) => {
            if (step) {
                if (index === stepNumber - 1) {
                    step.classList.add('active');
                    step.style.display = 'block';
                } else {
                    step.classList.remove('active');
                    step.style.display = 'none';
                }
            }
        });

        stateManager.set('currentStep', stepNumber);
        this.updateSteps(stepNumber);
    }

    /**
     * 显示设备更换步骤
     */
    showDeviceChangeSteps() {
        const step1 = document.getElementById('step1');
        const deviceChangeSteps = document.getElementById('deviceChangeSteps');

        console.log('showDeviceChangeSteps - step1:', step1);
        console.log('showDeviceChangeSteps - deviceChangeSteps:', deviceChangeSteps);

        // 隐藏第一步登录卡片
        if (step1) {
            step1.classList.remove('active');
            step1.style.display = 'none';
        }

        // 显示设备更换流程
        if (deviceChangeSteps) {
            deviceChangeSteps.classList.add('active');
            deviceChangeSteps.style.display = 'block';  // 明确设置为 block
        } else {
            console.error('deviceChangeSteps 元素未找到！');
        }

        stateManager.setState({ isDeviceChange: true });
    }

    /**
     * 跳过设备更换
     */
    skipDeviceChange() {
        const step1 = document.getElementById('step1');
        const deviceChangeSteps = document.getElementById('deviceChangeSteps');

        console.log('skipDeviceChange - step1:', step1);
        console.log('skipDeviceChange - deviceChangeSteps:', deviceChangeSteps);

        // 隐藏第一步登录卡片
        if (step1) {
            step1.classList.remove('active');
            step1.style.display = 'none';
        }

        // 隐藏设备更换流程
        if (deviceChangeSteps) {
            deviceChangeSteps.classList.remove('active');
            deviceChangeSteps.style.display = 'none';
        }

        stateManager.setState({ isDeviceChange: false });
        this.showSection(3); // 显示生成二维码步骤（第三步）
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

        // Session Token
        if (state.sessionToken) {
            this.elements.statusSessionToken.textContent = state.sessionToken;
            this.elements.statusSessionToken.className = 'status-value connected';
            this.addTooltip(this.elements.statusSessionToken, state.sessionToken);
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
        this.elements.esimInfo.innerHTML = `
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

        // 隐藏设备更换流程界面
        const step1 = document.getElementById('step1');
        if (step1) step1.style.display = 'block';

        if (this.elements.deviceChangeSteps) {
            this.elements.deviceChangeSteps.style.display = 'none';
        }

        this.showSection(1);
        this.updateSteps(1);
    }
}

// 创建单例实例
export const uiController = new UIController();
