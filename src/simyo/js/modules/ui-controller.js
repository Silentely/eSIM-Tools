/**
 * Simyo UI控制器模块
 * 负责UI状态更新、步骤切换、状态显示等
 */

import { stateManager } from './state-manager.js';
import { t, tl } from '../../../js/modules/i18n.js';

export class UIController {
    constructor() {
        this.tooltips = new Map();
        this._elementsCache = null;
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
            
            // 设备更换选项
            deviceChangeOption: document.getElementById('deviceChangeOption'),
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
        this.elements.sections.forEach((section, index) => {
            if (index === stepNumber - 1) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
        
        stateManager.set('currentStep', stepNumber);
        this.updateSteps(stepNumber);
    }
    
    /**
     * 显示设备更换选项
     */
    showDeviceChangeOption() {
        // 重新获取元素引用，确保DOM已加载
        const step1 = document.getElementById('step1');
        const deviceChangeOption = document.getElementById('deviceChangeOption');
        const deviceChangeSteps = document.getElementById('deviceChangeSteps');

        console.log('showDeviceChangeOption - step1:', step1);
        console.log('showDeviceChangeOption - deviceChangeOption:', deviceChangeOption);
        console.log('showDeviceChangeOption - deviceChangeSteps:', deviceChangeSteps);

        if (step1) step1.classList.remove('active');
        if (deviceChangeSteps) {
            deviceChangeSteps.classList.remove('active');
            deviceChangeSteps.style.display = 'none';
        }
        if (deviceChangeOption) {
            deviceChangeOption.classList.add('active');
            deviceChangeOption.style.display = 'block';  // 明确设置为 block
        } else {
            console.error('deviceChangeOption 元素未找到！');
        }

        const currentStep = stateManager.get('currentStep');
        stateManager.set('currentStep', Math.max(currentStep, 2));
        this.updateSteps(stateManager.get('currentStep'));
    }
    
    /**
     * 显示设备更换步骤
     */
    showDeviceChangeSteps() {
        const deviceChangeOption = document.getElementById('deviceChangeOption');
        const deviceChangeSteps = document.getElementById('deviceChangeSteps');

        console.log('showDeviceChangeSteps - deviceChangeOption:', deviceChangeOption);
        console.log('showDeviceChangeSteps - deviceChangeSteps:', deviceChangeSteps);

        if (deviceChangeOption) {
            deviceChangeOption.classList.remove('active');
            deviceChangeOption.style.display = 'none';
        }
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
        const deviceChangeOption = document.getElementById('deviceChangeOption');
        const deviceChangeSteps = document.getElementById('deviceChangeSteps');

        console.log('skipDeviceChange - deviceChangeOption:', deviceChangeOption);
        console.log('skipDeviceChange - deviceChangeSteps:', deviceChangeSteps);

        if (deviceChangeOption) {
            deviceChangeOption.classList.remove('active');
            deviceChangeOption.style.display = 'none';
        }
        if (deviceChangeSteps) {
            deviceChangeSteps.classList.remove('active');
            deviceChangeSteps.style.display = 'none';
        }

        stateManager.setState({ isDeviceChange: false });
        this.showSection(2); // 显示获取eSIM步骤
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
            this.elements.statusEsimStatus.textContent = tl('已申请');
            this.elements.statusEsimStatus.className = 'status-value connected';
        } else {
            this.elements.statusEsimStatus.textContent = tl('未申请');
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
     * 生成二维码
     */
    generateQRCode(data) {
        const size = 300;
        const vendors = [
            (s, d) => `https://qrcode.show/qr?size=${s}x${s}&data=${encodeURIComponent(d)}`,
            (s, d) => `https://quickchart.io/qr?size=${s}&text=${encodeURIComponent(d)}`,
            (s, d) => `https://chart.googleapis.com/chart?cht=qr&chs=${s}x${s}&chl=${encodeURIComponent(d)}`
        ];
        let vendorIdx = 0;

        const container = document.createElement('div');
        container.className = 'qrcode-container';
        container.style.position = 'relative';
        container.style.display = 'inline-block';

        const img = document.createElement('img');
        const setSrc = () => { img.src = vendors[vendorIdx](size, data); };
        setSrc();
        img.alt = tl('eSIM二维码');
        img.setAttribute('role', 'img');
        img.setAttribute('aria-label', tl('eSIM 安装二维码'));
        img.className = 'img-fluid';
        img.style.border = '5px solid white';
        img.style.borderRadius = '12px';
        img.style.maxWidth = `${size}px`;
        img.setAttribute('loading', 'lazy');
        
        img.onerror = () => {
            if (vendorIdx < vendors.length - 1) {
                vendorIdx += 1;
                setSrc();
            } else {
                this.elements.qrcode.innerHTML = `<div class="alert alert-warning">${tl('二维码生成失败，请复制下方 LPA 字符串手动安装。')}</div>`;
            }
        };

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.style.padding = '0';
        tooltip.style.background = 'none';
        tooltip.style.boxShadow = 'none';
        tooltip.style.willChange = 'transform';
        
        const largeImg = document.createElement('img');
        const setLargeSrc = () => { largeImg.src = vendors[vendorIdx](400, data); };
        setLargeSrc();
        largeImg.style.width = '400px';
        largeImg.style.height = '400px';
        tooltip.appendChild(largeImg);

        container.addEventListener('mouseenter', (e) => this.showTooltipElement(tooltip, e));
        container.addEventListener('mouseleave', () => this.hideTooltipElement(tooltip));

        container.appendChild(img);
        container.appendChild(tooltip);
        this.elements.qrcode.innerHTML = '';
        this.elements.qrcode.appendChild(container);
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
        this.elements.resultContainer.classList.add('active');
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
        
        // 隐藏设备更换相关界面
        const step1 = document.getElementById('step1');
        if (step1) step1.style.display = 'block';
        
        if (this.elements.deviceChangeOption) {
            this.elements.deviceChangeOption.style.display = 'none';
        }
        
        if (this.elements.deviceChangeSteps) {
            this.elements.deviceChangeSteps.style.display = 'none';
        }
        
        this.showSection(1);
        this.updateSteps(1);
    }
}

// 创建单例实例
export const uiController = new UIController();
