/**
 * Giffgaff 应用状态管理模块
 */
import secureStorage from '../secure-storage.js';

class AppState {
  constructor() {
    this.reset();
  }

  reset() {
    // OAuth相关
    this.codeVerifier = null;
    this.oauthState = null;
    this.accessToken = null;

    // MFA相关
    this.emailCodeRef = null;
    this.emailSignature = null;

    // 会员信息
    this.memberId = null;
    this.memberName = null;
    this.phoneNumber = null;

    // eSIM信息
    this.esimSSN = null;
    this.esimActivationCode = null;
    this.esimDeliveryStatus = null;
    this.lpaString = null;

    // 步骤控制
    this.currentStep = 1;

    // 会话信息
    this.sessionTimestamp = null;
  }

  // 保存会话到 localStorage
  saveSession() {
    const sessionData = {
      codeVerifier: this.codeVerifier,
      oauthState: this.oauthState,
      accessToken: this.accessToken,
      emailCodeRef: this.emailCodeRef,
      emailSignature: this.emailSignature,
      memberId: this.memberId,
      memberName: this.memberName,
      phoneNumber: this.phoneNumber,
      esimSSN: this.esimSSN,
      esimActivationCode: this.esimActivationCode,
      esimDeliveryStatus: this.esimDeliveryStatus,
      lpaString: this.lpaString,
      currentStep: this.currentStep,
      timestamp: Date.now()
    };

    secureStorage.setItem('giffgaff_session', sessionData);
  }

  // 从 localStorage 加载会话
  loadSession() {
    try {
      const sessionData = secureStorage.getItem('giffgaff_session');
      if (sessionData) {
        const data = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        const now = Date.now();
        const twoHours = 2 * 60 * 60 * 1000; // 2小时的毫秒数

        // 检查会话是否过期
        if (data.timestamp && (now - data.timestamp) < twoHours) {
          Object.assign(this, data);
          this.sessionTimestamp = data.timestamp;
          return true;
        } else {
          // 会话过期，清除
          this.clearSession();
        }
      }
    } catch (error) {
      console.error('加载会话失败:', error);
    }
    return false;
  }

  // 清除会话
  clearSession() {
    secureStorage.removeItem('giffgaff_session');
    this.reset();
  }

  // 获取适合的步骤
  getTargetStep() {
    if (this.emailSignature) {
      if (this.esimSSN || this.esimActivationCode) {
        if (this.lpaString) {
          return 6; // 结果页
        }
        return 5; // 获取eSIM Token
      }
      return 4; // 预订eSIM
    } else if (this.accessToken) {
      return 2; // 发送邮件验证码
    }
    return 1; // 初始步骤
  }
}

export default new AppState();
