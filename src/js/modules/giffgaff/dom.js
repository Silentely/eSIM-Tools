/**
 * Giffgaff DOM 管理模块
 */
import { getCurrentLocale, onLocaleChange } from '../i18n.js';

class DOMManager {
  constructor() {
    this.elements = {};
    this.initialized = false;
  }

  /**
   * 初始化 DOM 元素引用
   */
  init() {
    if (this.initialized) return;
    
    // 步骤元素
    this.elements.steps = document.querySelectorAll('.step');
    this.elements.sections = document.querySelectorAll('.section');
    
    // OAuth 相关
    this.elements.oauthLoginBtn = document.getElementById('oauthLoginBtn');
    this.elements.authUrlDisplay = document.getElementById('authUrlDisplay');
    this.elements.authUrlContainer = document.getElementById('authUrlContainer');
    this.elements.callbackUrl = document.getElementById('callbackUrl');
    this.elements.processCallbackBtn = document.getElementById('processCallbackBtn');
    this.elements.oauthStatus = document.getElementById('oauthStatus');
    
    // Cookie 相关
    this.elements.cookieInput = document.getElementById('cookieInput');
    this.elements.verifyCookieBtn = document.getElementById('verifyCookieBtn');
    this.elements.cookieStatus = document.getElementById('cookieStatus');
    
    // 邮件验证相关
    this.elements.sendEmailBtn = document.getElementById('sendEmailBtn');
    this.elements.emailCode = document.getElementById('emailCode');
    this.elements.verifyEmailBtn = document.getElementById('verifyEmailBtn');
    this.elements.emailStatus = document.getElementById('emailStatus');
    this.elements.emailCodeSection = document.getElementById('emailCodeSection');
    
    // 会员信息相关
    this.elements.getMemberBtn = document.getElementById('getMemberBtn');
    this.elements.memberStatus = document.getElementById('memberStatus');
    this.elements.memberInfo = document.getElementById('memberInfo');
    
    // eSIM 相关
    this.elements.reserveESimBtn = document.getElementById('reserveESimBtn');
    this.elements.reserveStatus = document.getElementById('reserveStatus');
    this.elements.esimInfo = document.getElementById('esimInfo');
    this.elements.getESimTokenBtn = document.getElementById('getESimTokenBtn');
    this.elements.tokenStatus = document.getElementById('tokenStatus');
    
    // 结果显示
    this.elements.resultSection = document.getElementById('resultSection');
    this.elements.qrcode = document.getElementById('qrcode');
    this.elements.lpaString = document.getElementById('lpaString');
    
    // 状态显示
    this.elements.tokenStatus = document.getElementById('tokenStatus');
    this.elements.signatureStatus = document.getElementById('signatureStatus');
    this.elements.sessionStatus = document.getElementById('sessionStatus');
    
    // 服务时间相关
    this.elements.serviceTimeAlert = document.getElementById('serviceTimeAlert');
    this.elements.currentTime = document.getElementById('currentTime');
    
    // 其他
    this.elements.clearSessionBtn = document.getElementById('clearSessionBtn');
    this.elements.tutorialBtn = document.getElementById('tutorialBtn');

    // 绑定教程按钮：根据当前语言动态切换教程链接
    if (this.elements.tutorialBtn) {
      const updateTutorialHref = () => {
        const url = getCurrentLocale() === 'en'
          ? 'https://github.com/Silentely/eSIM-Tools/blob/main/docs/User_Guide_EN.md'
          : 'https://github.com/Silentely/eSIM-Tools/blob/main/docs/User_Guide.md';
        if (this.elements.tutorialBtn.tagName === 'A') {
          this.elements.tutorialBtn.href = url;
        }
      };
      updateTutorialHref();
      onLocaleChange(updateTutorialHref);

      if (this.elements.tutorialBtn.tagName !== 'A') {
        this.elements.tutorialBtn.addEventListener('click', () => {
          const url = getCurrentLocale() === 'en'
            ? 'https://github.com/Silentely/eSIM-Tools/blob/main/docs/User_Guide_EN.md'
            : 'https://github.com/Silentely/eSIM-Tools/blob/main/docs/User_Guide.md';
          window.open(url, '_blank');
        });
      }
    }

    this.initialized = true;
  }

  /**
   * 绑定按钮点击事件
   */
  bindButtonClick(elementId, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener('click', handler);
    }
  }

  /**
   * 获取输入值
   */
  getValue(elementId) {
    const element = document.getElementById(elementId) || this.elements[elementId];
    return element ? element.value.trim() : '';
  }

  /**
   * 设置输入值
   */
  setValue(elementId, value) {
    const element = document.getElementById(elementId) || this.elements[elementId];
    if (element) {
      element.value = value;
    }
  }

  /**
   * 显示元素
   */
  showElement(elementId) {
    const element = document.getElementById(elementId) || this.elements[elementId];
    if (element) {
      element.style.display = 'block';
    }
  }

  /**
   * 隐藏元素
   */
  hideElement(elementId) {
    const element = document.getElementById(elementId) || this.elements[elementId];
    if (element) {
      element.style.display = 'none';
    }
  }

  /**
   * 显示状态消息
   */
  showStatus(elementId, message, type) {
    const element = document.getElementById(elementId) || this.elements[elementId];
    if (!element) return;
    
    element.textContent = message;
    element.className = type === 'success' ? 'text-success' : 
                       type === 'error' ? 'text-danger' : 
                       type === 'info' ? 'text-info' :
                       'text-muted';
    element.style.display = 'block';
  }

  /**
   * 导航到指定步骤
   */
  navigateToStep(stepNumber) {
    // 更新步骤指示器
    this.updateSteps(stepNumber);
    
    // 显示对应的内容区域
    this.showSection(stepNumber);
    
    // 滚动到顶部
    window.scrollTo(0, 0);
  }

  /**
   * 更新步骤指示器
   */
  updateSteps(currentStep) {
    this.elements.steps?.forEach((step, index) => {
      if (index < currentStep - 1) {
        step.classList.add('completed');
        step.classList.remove('active');
      } else if (index === currentStep - 1) {
        step.classList.add('active');
        step.classList.remove('completed');
      } else {
        step.classList.remove('active', 'completed');
      }
    });
  }

  /**
   * 显示对应的内容区域
   */
  showSection(stepNumber) {
    this.elements.sections?.forEach((section, index) => {
      if (index === stepNumber - 1) {
        section.style.display = 'block';
        section.classList.add('fade-in');
      } else {
        section.style.display = 'none';
      }
    });
  }

  /**
   * 显示会员信息
   */
  displayMemberInfo(state) {
    const memberInfo = document.getElementById('memberInfo');
    if (!memberInfo) return;
    
    memberInfo.innerHTML = `
      <div class="info-item">
        <strong>会员ID:</strong> <span class="text-primary">${state.memberId || 'N/A'}</span>
      </div>
      <div class="info-item">
        <strong>会员名称:</strong> <span class="text-primary">${state.memberName || 'N/A'}</span>
      </div>
      <div class="info-item">
        <strong>手机号码:</strong> <span class="text-primary">${state.phoneNumber || 'N/A'}</span>
      </div>
    `;
    memberInfo.style.display = 'block';
  }

  /**
   * 显示 eSIM 信息
   */
  displayESIMInfo(state) {
    const esimInfo = document.getElementById('esimInfo');
    if (!esimInfo) return;
    
    esimInfo.innerHTML = `
      <div class="info-item">
        <strong>SSN:</strong> 
        <span class="text-primary" id="displaySSN">${state.esimSSN || 'N/A'}</span>
        <button class="btn btn-sm btn-outline-primary ms-2" onclick="app.utils.copyToClipboard('${state.esimSSN}')">
          <i class="fas fa-copy"></i> 复制
        </button>
      </div>
      <div class="info-item">
        <strong>激活码:</strong> 
        <span class="text-primary" id="displayActivationCode">${state.esimActivationCode || 'N/A'}</span>
        <button class="btn btn-sm btn-outline-primary ms-2" onclick="app.utils.copyToClipboard('${state.esimActivationCode}')">
          <i class="fas fa-copy"></i> 复制
        </button>
      </div>
      <div class="info-item">
        <strong>状态:</strong> 
        <span class="badge bg-info">${state.esimDeliveryStatus || 'RESERVED'}</span>
      </div>
      <div class="alert alert-info mt-3">
        <i class="fas fa-info-circle"></i>
        已为您预留 eSIM（状态 RESERVED）。请保持本页面开启，前往 <a href="https://www.giffgaff.com/activate" target="_blank" rel="noopener">giffgaff 激活页</a> 手动输入上方激活码并点击 “Activate your SIM”，随后确认 “Yes, I want to replace my SIM”。完成后返回本页点击“获取 eSIM Token”继续。
      </div>
    `;
    esimInfo.style.display = 'block';
  }

  /**
   * 显示 eSIM 结果
   */
  displayESIMResult(state) {
    if (!state.lpaString) return;
    
    // 显示 LPA 字符串
    const lpaElement = document.getElementById('lpaString');
    if (lpaElement) {
      lpaElement.textContent = state.lpaString;
    }
    
    // 生成二维码
    const qrcodeElement = document.getElementById('qrcode');
    if (qrcodeElement) {
      const qrSize = 300;
      const qrUrl = `https://qrcode.show/${encodeURIComponent(state.lpaString)}?size=${qrSize}`;
      
      qrcodeElement.innerHTML = `
        <img src="${qrUrl}" alt="eSIM QR Code" class="img-fluid" />
        <div class="mt-3">
          <button class="btn btn-primary" onclick="app.utils.copyToClipboard('${state.lpaString}')">
            <i class="fas fa-copy"></i> 复制LPA字符串
          </button>
          <a href="${qrUrl}" download="esim-qrcode.png" class="btn btn-success ms-2">
            <i class="fas fa-download"></i> 下载二维码
          </a>
        </div>
      `;
    }
    
    // 显示结果区域
    const resultSection = document.getElementById('resultSection');
    if (resultSection) {
      resultSection.style.display = 'block';
    }
  }

  /**
   * 更新状态显示
   */
  updateStatusDisplay(state) {
    // 更新访问令牌状态
    const tokenStatus = document.getElementById('tokenStatus');
    if (tokenStatus) {
      if (state.accessToken) {
        tokenStatus.innerHTML = '<i class="fas fa-check-circle text-success"></i> 已获取';
      } else {
        tokenStatus.innerHTML = '<i class="fas fa-times-circle text-danger"></i> 未获取';
      }
    }
    
    // 更新签名状态
    const signatureStatus = document.getElementById('signatureStatus');
    if (signatureStatus) {
      if (state.emailSignature) {
        signatureStatus.innerHTML = '<i class="fas fa-check-circle text-success"></i> 已验证';
      } else {
        signatureStatus.innerHTML = '<i class="fas fa-times-circle text-danger"></i> 未验证';
      }
    }
    
    // 更新会话状态
    const sessionStatus = document.getElementById('sessionStatus');
    if (sessionStatus) {
      if (state.sessionTimestamp) {
        const timeAgo = Math.floor((Date.now() - state.sessionTimestamp) / 60000);
        sessionStatus.innerHTML = `<i class="fas fa-clock text-info"></i> ${timeAgo}分钟前`;
      } else {
        sessionStatus.innerHTML = '<i class="fas fa-times-circle text-muted"></i> 无会话';
      }
    }
  }

  /**
   * 更新服务时间显示
   */
  updateServiceTimeDisplay(isAvailable) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const ukTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
      timeElement.textContent = localTime;
    }
    const ukHint = document.getElementById('ukTimeHint');
    if (ukHint) {
      ukHint.textContent = `英国时间 ${ukTime}`;
    }
    
    const alertElement = document.getElementById('serviceTimeAlert');
    if (alertElement) {
      if (isAvailable) {
        alertElement.className = 'alert alert-success';
        alertElement.innerHTML = `
          <i class="fas fa-check-circle"></i>
          <strong>服务可用</strong> - 本地 ${localTime} / 英国 ${ukTime}（服务窗口 04:30-21:30）
        `;
      } else {
        alertElement.className = 'alert alert-warning';
        alertElement.innerHTML = `
          <i class="fas fa-exclamation-triangle"></i>
          <strong>服务时间外</strong> - 本地 ${localTime} / 英国 ${ukTime}
          <br><small>SIM 交换服务窗口：英国时间 04:30 至 21:30。您仍可浏览信息，部分操作可能失败。</small>
        `;
      }
    }
  }

  /**
   * 显示服务时间警告
   */
  showServiceTimeWarning() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal fade show';
      modal.style.display = 'block';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      
      const now = new Date();
      const localTime = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
      const ukTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);

      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-warning text-dark">
              <h5 class="modal-title">
                <i class="fas fa-exclamation-triangle"></i> 服务时间警告
              </h5>
            </div>
            <div class="modal-body">
              <p>SIM 交换服务窗口为 <strong>英国时间 04:30 至 21:30</strong>。</p>
              <p>当前时间：本地 ${localTime} / 英国 ${ukTime}。</p>
              <p>窗口外操作可能失败或不稳定，建议在服务窗口内进行。</p>
              <p class="mb-0"><strong>是否继续操作？</strong></p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="cancelBtn">取消</button>
              <button class="btn btn-warning" id="continueBtn">继续</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const handleChoice = (choice) => {
        modal.remove();
        resolve(choice);
      };
      
      document.getElementById('cancelBtn').onclick = () => handleChoice(false);
      document.getElementById('continueBtn').onclick = () => handleChoice(true);
    });
  }
}

export default new DOMManager();
