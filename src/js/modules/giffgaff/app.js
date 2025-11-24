/**
 * Giffgaff eSIM 主应用控制器
 */

import appState from './state.js';
import oauthManager from './oauth.js';
import apiManager from './api.js';
import utils from './utils.js';
import domManager from './dom.js';
import captchaManager from '../captcha-manager.js';

class GiffgaffApp {
  constructor() {
    this.state = appState;
    this.oauth = oauthManager;
    this.api = apiManager;
    this.utils = utils;
    this.dom = domManager;
    
    this.initialized = false;
  }

  /**
   * 初始化应用
   */
  async init() {
    if (this.initialized) return;
    
    try {
      await captchaManager.init();
    } catch (error) {
      console.error('[Giffgaff App] captcha init failed', error);
    }
    
    try {
      // 添加动画样式
      this.utils.addAnimationStyles();
      
      // 初始化 DOM 管理器
      this.dom.init();
      
      // 绑定事件监听器
      this.bindEventListeners();
      
      // 加载会话
      const sessionRestored = this.state.loadSession();
      if (sessionRestored) {
        const targetStep = this.state.getTargetStep();
        this.dom.navigateToStep(targetStep);
        this.utils.showToast('会话已恢复');
      }
      
      // 更新状态显示
      this.updateStatusDisplay();
      
      // 启动服务时间检查
      this.startServiceTimeCheck();
      
      this.initialized = true;
      // 初始化完成
      
    } catch (error) {
      console.error('初始化失败:', error);
      this.utils.showToast('初始化失败，请刷新页面重试', 5000);
    }
  }

  /**
   * 绑定事件监听器
   */
  bindEventListeners() {
    // OAuth 登录
    this.dom.bindButtonClick('oauthLoginBtn', () => this.handleOAuthLogin());
    
    // 处理回调
    this.dom.bindButtonClick('processCallbackBtn', () => this.handleOAuthCallback());
    
    // Cookie 验证
    this.dom.bindButtonClick('verifyCookieBtn', () => this.handleCookieVerification());
    
    // 发送邮件验证码
    this.dom.bindButtonClick('sendEmailBtn', () => this.handleSendEmail());
    
    // 验证邮件验证码
    this.dom.bindButtonClick('verifyEmailBtn', () => this.handleVerifyEmail());
    
    // 获取会员信息
    this.dom.bindButtonClick('getMemberBtn', () => this.handleGetMember());
    
    // 预订 eSIM
    this.dom.bindButtonClick('reserveESimBtn', () => this.handleReserveESIM());
    
    // 获取 eSIM Token
    this.dom.bindButtonClick('getESimTokenBtn', () => this.handleGetESIMToken());
    
    // 清除会话
    this.dom.bindButtonClick('clearSessionBtn', () => this.handleClearSession());
  }

  /**
   * OAuth 登录处理
   */
  async handleOAuthLogin() {
    try {
      if (!this.utils.isServiceTimeAvailable()) {
        const shouldContinue = await this.dom.showServiceTimeWarning();
        if (!shouldContinue) return;
      }
      
      this.dom.showStatus('oauthStatus', '正在生成授权链接...', 'info');
      
      // 生成 PKCE 参数
      this.state.codeVerifier = this.oauth.generateCodeVerifier();
      // 同时生成并持久化 OAuth state，供回调校验
      this.state.oauthState = this.oauth.generateState();
      const authUrl = await this.oauth.buildAuthorizationUrl(this.state.codeVerifier, this.state.oauthState);
      
      // 显示授权 URL
      this.dom.setValue('authUrlDisplay', authUrl);
      this.dom.showElement('authUrlContainer');
      
      // 自动复制到剪贴板
      await this.utils.copyToClipboard(authUrl);
      this.utils.showToast('授权链接已复制到剪贴板');
      
      this.dom.showStatus('oauthStatus', '请在浏览器中打开授权链接并完成登录', 'success');
      
      // 保存状态
      this.state.saveSession();
      
    } catch (error) {
      console.error('OAuth登录失败:', error);
      this.dom.showStatus('oauthStatus', `登录失败: ${error.message}`, 'error');
    }
  }

  /**
   * 处理 OAuth 回调
   */
  async handleOAuthCallback() {
    try {
      const callbackUrl = this.dom.getValue('callbackUrl');
      if (!callbackUrl) {
        this.dom.showStatus('oauthStatus', '请输入回调URL', 'error');
        return;
      }
      
      this.dom.showStatus('oauthStatus', '正在处理回调...', 'info');
      
      // 提取授权码
      const code = this.oauth.extractCodeFromCallback(callbackUrl);
      if (!code) {
        throw new Error('无法从回调URL中提取授权码');
      }
      
      // 可选：校验回调中的 state（标准 URL 才有）
      try {
        const url = new URL(callbackUrl);
        const returnedState = url.searchParams.get('state');
        if (returnedState && this.state.oauthState && returnedState !== this.state.oauthState) {
          throw new Error('State 校验失败，请重新开始登录');
        }
      } catch (_) {}

      // 交换访问令牌（服务端代办）
      const tokenData = await this.oauth.exchangeToken(code, this.state.codeVerifier);
      this.state.accessToken = tokenData.access_token;
      
      // 保存状态并导航到下一步
      this.state.saveSession();
      this.updateStatusDisplay();
      
      this.dom.showStatus('oauthStatus', 'OAuth认证成功！', 'success');
      this.utils.showToast('认证成功，正在跳转到下一步...');
      
      setTimeout(() => {
        this.dom.navigateToStep(2);
      }, 1500);
      
    } catch (error) {
      console.error('处理OAuth回调失败:', error);
      this.dom.showStatus('oauthStatus', `处理失败: ${error.message}`, 'error');
    }
  }

  /**
   * Cookie 验证处理
   */
  async handleCookieVerification() {
    try {
      if (!this.utils.isServiceTimeAvailable()) {
        const shouldContinue = await this.dom.showServiceTimeWarning();
        if (!shouldContinue) return;
      }
      
      const cookie = this.dom.getValue('cookieInput');
      if (!cookie) {
        this.dom.showStatus('cookieStatus', '请输入Cookie', 'error');
        return;
      }
      
      this.dom.showStatus('cookieStatus', '正在验证Cookie...', 'info');
      const loading = this.utils.showLoading('正在验证Cookie...');
      
      const result = await this.api.verifyCookie(cookie);
      
      this.utils.hideLoading(loading);
      
      if (result.valid) {
        // 保存认证信息
        this.state.accessToken = result.accessToken;
        this.state.emailSignature = result.emailSignature; // 仍可能为 null
        this.state.memberId = result.memberId || this.state.memberId;
        
        this.state.saveSession();
        this.updateStatusDisplay();
        
        this.dom.showStatus('cookieStatus', 'Cookie验证成功！', 'success');
        this.utils.showToast('验证成功，正在跳转...');
        
        // 根据获得的信息决定跳转步骤
        const targetStep = this.state.getTargetStep();
        setTimeout(() => {
          this.dom.navigateToStep(targetStep);
        }, 1500);
      } else {
        throw new Error(result.message || 'Cookie验证失败');
      }
      
    } catch (error) {
      console.error('Cookie验证失败:', error);
      const msg =
        /429/.test(error.message) ? '请求过于频繁，请稍后重试（429）。' :
        /403/.test(error.message) ? '权限不足或登录过期（403），请重新登录或更换 Cookie。' :
        /超时|timeout|timed out/i.test(error.message) ? '请求超时，请检查网络后重试。' :
        `验证失败: ${error.message}`;
      this.dom.showStatus('cookieStatus', msg, 'error');
    }
  }

  /**
   * 发送邮件验证码
   */
  async handleSendEmail() {
    try {
      if (!this.utils.isServiceTimeAvailable()) {
        const shouldContinue = await this.dom.showServiceTimeWarning();
        if (!shouldContinue) return;
      }
      
      if (!this.state.accessToken) {
        this.dom.showStatus('emailStatus', '请先完成OAuth认证', 'error');
        return;
      }
      
      this.dom.showStatus('emailStatus', '正在发送验证码...', 'info');
      
      const data = await this.api.sendMFAChallenge(this.state.accessToken);
      this.state.emailCodeRef = data.ref;
      
      this.dom.showStatus('emailStatus', '验证码已发送到您的邮箱', 'success');
      this.dom.showElement('emailCodeSection');
      
      this.state.saveSession();
      
    } catch (error) {
      console.error('发送邮件失败:', error);
      this.dom.showStatus('emailStatus', `发送失败: ${error.message}`, 'error');
    }
  }

  /**
   * 验证邮件验证码
   */
  async handleVerifyEmail() {
    try {
      const code = this.dom.getValue('emailCode');
      if (!code) {
        this.dom.showStatus('emailStatus', '请输入验证码', 'error');
        return;
      }
      
      if (!this.state.emailCodeRef) {
        this.dom.showStatus('emailStatus', '请先发送验证码', 'error');
        return;
      }
      
      this.dom.showStatus('emailStatus', '正在验证...', 'info');
      
      const data = await this.api.validateMFACode(
        this.state.accessToken,
        this.state.emailCodeRef,
        code
      );
      
      this.state.emailSignature = data.signature;
      
      this.dom.showStatus('emailStatus', '验证成功！', 'success');
      this.utils.showToast('邮件验证成功');
      
      this.state.saveSession();
      this.updateStatusDisplay();
      
      setTimeout(() => {
        this.dom.navigateToStep(3);
      }, 1500);
      
    } catch (error) {
      console.error('验证邮件失败:', error);
      this.dom.showStatus('emailStatus', `验证失败: ${error.message}`, 'error');
    }
  }

  /**
   * 获取会员信息
   */
  async handleGetMember() {
    try {
      if (!this.state.accessToken) {
        this.dom.showStatus('memberStatus', '请先完成认证', 'error');
        return;
      }
      
      this.dom.showStatus('memberStatus', '正在获取会员信息...', 'info');
      
      let data = await this.api.getMemberProfile(this.state.accessToken);
      
      if (data.data?.memberProfile) {
        this.state.memberId = data.data.memberProfile.id;
        this.state.memberName = data.data.memberProfile.memberName;
      }
      
      if (data.data?.sim) {
        this.state.phoneNumber = data.data.sim.phoneNumber;
      }

      // 兜底：若缺失 memberId，再尝试一次（可因 token 刷新或网络抖动导致）
      if (!this.state.memberId) {
        data = await this.api.getMemberProfile(this.state.accessToken);
        if (data.data?.memberProfile?.id) {
          this.state.memberId = data.data.memberProfile.id;
          this.state.memberName = data.data.memberProfile.memberName;
        }
      }
      
      // 显示会员信息
      this.dom.displayMemberInfo(this.state);
      
      this.dom.showStatus('memberStatus', '获取成功！', 'success');
      
      this.state.saveSession();
      this.updateStatusDisplay();
      
      setTimeout(() => {
        this.dom.navigateToStep(4);
      }, 1500);
      
    } catch (error) {
      console.error('获取会员信息失败:', error);
      this.dom.showStatus('memberStatus', `获取失败: ${error.message}`, 'error');
    }
  }

  /**
   * 预订 eSIM
   */
  async handleReserveESIM() {
    try {
      if (!this.utils.isServiceTimeAvailable()) {
        const shouldContinue = await this.dom.showServiceTimeWarning();
        if (!shouldContinue) return;
      }
      
      if (!this.state.memberId || !this.state.emailSignature) {
        this.dom.showStatus('reserveStatus', '请先完成前面的步骤', 'error');
        return;
      }
      
      this.dom.showStatus('reserveStatus', '正在预订eSIM...', 'info');
      
      const data = await this.api.reserveESIM(
        this.state.accessToken,
        this.state.memberId,
        this.state.emailSignature
      );
      
      if (data.data?.reserveESim?.esim) {
        const esim = data.data.reserveESim.esim;
        this.state.esimSSN = esim.ssn;
        this.state.esimActivationCode = esim.activationCode;
        this.state.esimDeliveryStatus = esim.deliveryStatus;
        
        // 显示 eSIM 信息
        this.dom.displayESIMInfo(this.state);
        
        this.dom.showStatus('reserveStatus', 'eSIM预订成功！', 'success');
        
        this.state.saveSession();
        
        setTimeout(() => {
          this.dom.navigateToStep(5);
        }, 1500);
      } else {
        throw new Error('预订响应中没有eSIM信息');
      }
      
    } catch (error) {
      console.error('预订eSIM失败:', error);
      this.dom.showStatus('reserveStatus', `预订失败: ${error.message}`, 'error');
    }
  }

  /**
   * 获取 eSIM Token
   */
  async handleGetESIMToken() {
    try {
      if (!this.state.esimSSN) {
        this.dom.showStatus('tokenStatus', '请先预订eSIM', 'error');
        return;
      }
      
      this.dom.showStatus('tokenStatus', '正在获取eSIM下载信息...', 'info');
      
      const data = await this.api.getESIMToken(
        this.state.accessToken,
        this.state.esimSSN
      );
      
      if (data.data?.eSimDownloadToken) {
        this.state.lpaString = data.data.eSimDownloadToken.lpaString;
        
        // 显示结果
        this.dom.displayESIMResult(this.state);
        
        this.dom.showStatus('tokenStatus', '获取成功！', 'success');
        
        this.state.saveSession();
        
        setTimeout(() => {
          this.dom.navigateToStep(6);
        }, 1500);
      } else {
        throw new Error('响应中没有下载信息');
      }
      
    } catch (error) {
      console.error('获取eSIM Token失败:', error);
      this.dom.showStatus('tokenStatus', `获取失败: ${error.message}`, 'error');
    }
  }

  /**
   * 清除会话
   */
  handleClearSession() {
    if (confirm('确定要清除所有会话数据吗？这将重置所有进度。')) {
      this.state.clearSession();
      this.updateStatusDisplay();
      this.dom.navigateToStep(1);
      this.utils.showToast('会话已清除');
    }
  }

  /**
   * 更新状态显示
   */
  updateStatusDisplay() {
    this.dom.updateStatusDisplay(this.state);
  }

  /**
   * 启动服务时间检查
   */
  startServiceTimeCheck() {
    this.checkServiceTime();
    // 每分钟检查一次
    setInterval(() => this.checkServiceTime(), 60000);
  }

  /**
   * 检查服务时间
   */
  checkServiceTime() {
    const isAvailable = this.utils.isServiceTimeAvailable();
    this.dom.updateServiceTimeDisplay(isAvailable);
  }
}

// 创建全局实例
const app = new GiffgaffApp();

// 自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

export default app;
