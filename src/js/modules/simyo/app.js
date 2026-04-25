/**
 * Simyo eSIM 应用控制器
 */

import apiManager from './api.js';
import HTMLSanitizer from '../html-sanitizer.js';
import SecureStorage from '../secure-storage.js';

class SimyoApp {
  constructor() {
    this.api = apiManager;
    this.state = {
      token: null,
      username: null,
      phoneNumber: null,
      esimData: null,
      currentStep: 1
    };

    this.initialized = false;
  }

  /**
   * 初始化应用
   */
  async init() {
    if (this.initialized) return;

    try {
      this.bindEventListeners();
      this.loadSession();
      this.initialized = true;
      // 初始化完成
    } catch (error) {
      console.error('初始化失败:', error);
    }
  }

  /**
   * 绑定事件监听器
   */
  bindEventListeners() {
    // 登录
    const loginBtn = document.getElementById('simyoLoginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
    }

    // 发送短信验证码
    const sendSmsBtn = document.getElementById('sendSmsBtn');
    if (sendSmsBtn) {
      sendSmsBtn.addEventListener('click', () => this.handleSendSMS());
    }

    // 验证短信验证码
    const verifySmsBtn = document.getElementById('verifySmsBtn');
    if (verifySmsBtn) {
      verifySmsBtn.addEventListener('click', () => this.handleVerifySMS());
    }

    // 设备更换
    const deviceChangeBtn = document.getElementById('deviceChangeBtn');
    if (deviceChangeBtn) {
      deviceChangeBtn.addEventListener('click', () => this.handleDeviceChange());
    }

    // 确认安装
    const confirmInstallBtn = document.getElementById('confirmInstallBtn');
    if (confirmInstallBtn) {
      confirmInstallBtn.addEventListener('click', () => this.handleConfirmInstall());
    }
  }

  /**
   * 处理登录
   */
  async handleLogin() {
    try {
      const usernameEl = document.getElementById('simyoUsername');
      const passwordEl = document.getElementById('simyoPassword');
      const username = usernameEl ? usernameEl.value : undefined;
      const password = passwordEl ? passwordEl.value : undefined;

      if (!username || !password) {
        this.showStatus('loginStatus', '请输入用户名和密码', 'error');
        return;
      }

      this.showStatus('loginStatus', '正在登录...', 'info');

      const response = await this.api.login(username, password);

      if (response.success) {
        this.state.token = response.token;
        this.state.username = username;
        this.saveSession();

        this.showStatus('loginStatus', '登录成功！', 'success');
        this.navigateToStep(2);
      } else {
        throw new Error(response.message || '登录失败');
      }

    } catch (error) {
      console.error('登录失败:', error);
      this.showStatus('loginStatus', `登录失败: ${error.message}`, 'error');
    }
  }

  /**
   * 发送短信验证码
   */
  async handleSendSMS() {
    try {
      if (!this.state.token) {
        this.showStatus('smsStatus', '请先登录', 'error');
        return;
      }

      this.showStatus('smsStatus', '正在发送验证码...', 'info');

      const response = await this.api.sendSMSCode(this.state.token);

      if (response.success) {
        this.showStatus('smsStatus', '验证码已发送到您的手机', 'success');
        const smsCodeSection = document.getElementById('smsCodeSection');
        if (smsCodeSection) smsCodeSection.style.display = 'block';
      } else {
        throw new Error(response.message || '发送失败');
      }

    } catch (error) {
      console.error('发送短信失败:', error);
      this.showStatus('smsStatus', `发送失败: ${error.message}`, 'error');
    }
  }

  /**
   * 验证短信验证码
   */
  async handleVerifySMS() {
    try {
      const codeEl = document.getElementById('smsCode');
      const code = codeEl ? codeEl.value : undefined;

      if (!code) {
        this.showStatus('smsStatus', '请输入验证码', 'error');
        return;
      }

      this.showStatus('smsStatus', '正在验证...', 'info');

      const response = await this.api.verifyCode(this.state.token, code);

      if (response.success) {
        this.showStatus('smsStatus', '验证成功！', 'success');
        this.navigateToStep(3);
      } else {
        throw new Error(response.message || '验证失败');
      }

    } catch (error) {
      console.error('验证失败:', error);
      this.showStatus('smsStatus', `验证失败: ${error.message}`, 'error');
    }
  }

  /**
   * 处理设备更换
   */
  async handleDeviceChange() {
    try {
      if (!this.state.token) {
        this.showStatus('deviceStatus', '请先完成认证', 'error');
        return;
      }

      this.showStatus('deviceStatus', '正在处理设备更换...', 'info');

      const response = await this.api.requestDeviceChange(this.state.token);

      if (response.success && response.esimData) {
        this.state.esimData = response.esimData;
        this.displayESIMData(response.esimData);

        this.showStatus('deviceStatus', '设备更换成功！', 'success');
        this.saveSession();
        this.navigateToStep(4);
      } else {
        throw new Error(response.message || '设备更换失败');
      }

    } catch (error) {
      console.error('设备更换失败:', error);
      this.showStatus('deviceStatus', `处理失败: ${error.message}`, 'error');
    }
  }

  /**
   * 确认安装
   */
  async handleConfirmInstall() {
    try {
      if (!this.state.token || !this.state.esimData) {
        this.showStatus('installStatus', '请先完成设备更换', 'error');
        return;
      }

      this.showStatus('installStatus', '正在确认安装...', 'info');

      const response = await this.api.confirmInstallation(this.state.token);

      if (response.success) {
        this.showStatus('installStatus', 'eSIM 安装确认成功！', 'success');
        this.showCompletionMessage();
      } else {
        throw new Error(response.message || '确认失败');
      }

    } catch (error) {
      console.error('确认安装失败:', error);
      this.showStatus('installStatus', `确认失败: ${error.message}`, 'error');
    }
  }

  /**
   * 显示 eSIM 数据
   */
  displayESIMData(esimData) {
    const displayElement = document.getElementById('esimDataDisplay');
    if (!displayElement) return;

    const qrCodeUrl = `https://qrcode.show/${encodeURIComponent(esimData.lpaString)}?size=300`;

    displayElement.innerHTML = `
      <div class="esim-info">
        <h4>您的 eSIM 信息</h4>
        <div class="qrcode-container">
          <img src="${qrCodeUrl}" alt="eSIM QR Code" class="img-fluid" />
        </div>
        <div class="lpa-string mt-3">
          <strong>LPA 字符串:</strong>
          <div class="code-display">${HTMLSanitizer.escapeHtml(esimData.lpaString)}</div>
          <button class="btn btn-primary mt-2" data-copy-lpa="${HTMLSanitizer.escapeAttr(esimData.lpaString)}">
            <i class="fas fa-copy"></i> 复制
          </button>
        </div>
      </div>
    `;

    // 通过 addEventListener 绑定复制按钮，避免内联 onclick 的 XSS 风险
    const copyBtn = displayElement.querySelector('[data-copy-lpa]');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyToClipboard(copyBtn.dataset.copyLpa));
    }
  }

  /**
   * 显示完成消息
   */
  showCompletionMessage() {
    const messageElement = document.getElementById('completionMessage');
    if (messageElement) {
      messageElement.style.display = 'block';
      messageElement.innerHTML = `
        <div class="alert alert-success">
          <h4><i class="fas fa-check-circle"></i> 恭喜！</h4>
          <p>您的 eSIM 已成功配置并确认安装。</p>
          <p>请在您的设备设置中添加移动套餐，扫描二维码或手动输入 LPA 字符串。</p>
        </div>
      `;
    }
  }

  /**
   * 导航到指定步骤
   */
  navigateToStep(stepNumber) {
    this.state.currentStep = stepNumber;

    // 隐藏所有步骤
    document.querySelectorAll('.simyo-step').forEach(step => {
      step.style.display = 'none';
    });

    // 显示当前步骤
    const currentStep = document.getElementById(`simyoStep${stepNumber}`);
    if (currentStep) {
      currentStep.style.display = 'block';
    }

    // 更新步骤指示器
    document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
      if (index < stepNumber - 1) {
        indicator.classList.add('completed');
        indicator.classList.remove('active');
      } else if (index === stepNumber - 1) {
        indicator.classList.add('active');
        indicator.classList.remove('completed');
      } else {
        indicator.classList.remove('active', 'completed');
      }
    });
  }

  /**
   * 显示状态消息
   */
  showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = message;
    element.className = type === 'success' ? 'text-success' :
                       type === 'error' ? 'text-danger' :
                       type === 'info' ? 'text-info' :
                       'text-muted';
    element.style.display = 'block';
  }

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('已复制到剪贴板');
    } catch (err) {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('已复制到剪贴板');
    }
  }

  /**
   * 显示 Toast 通知
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideUp 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * 保存会话
   */
  saveSession() {
    SecureStorage.setItem('simyo_session', {
      token: this.state.token,
      username: this.state.username,
      esimData: this.state.esimData,
      currentStep: this.state.currentStep
    }, 3600000); // 1 小时 TTL
  }

  /**
   * 加载会话
   */
  loadSession() {
    try {
      const data = SecureStorage.getItem('simyo_session');
      if (data) {
        Object.assign(this.state, data);
        this.navigateToStep(data.currentStep || 1);
        return true;
      }
    } catch (error) {
      console.error('加载会话失败:', error);
    }
    return false;
  }
}

// 创建全局实例
const simyoApp = new SimyoApp();

// 自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => simyoApp.init());
} else {
  simyoApp.init();
}

// 暴露到全局
window.simyoApp = simyoApp;

export default simyoApp;
