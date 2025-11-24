import Logger from '../logger.js';

/**
 * Giffgaff API 交互模块
 */

class APIManager {
  constructor() {
    // 统一通过无服务器函数代理，避免环境分歧与CORS问题
    this.endpoints = {
      mfaChallenge: "/bff/giffgaff-mfa-challenge",
      mfaValidation: "/bff/giffgaff-mfa-validation",
      graphql: "/bff/giffgaff-graphql",
      tokenExchange: "/bff/giffgaff-token-exchange",
      cookieVerify: "/bff/verify-cookie",
      autoActivate: "/bff/auto-activate-esim",
      smsActivate: "/bff/giffgaff-sms-activate"
    };

    // 验证码 token 获取器（Turnstile / reCAPTCHA）
    this.getCaptchaToken = () => {
      try {
        if (typeof window !== 'undefined') {
          return window.__captchaToken || window.__cfTurnstileToken || undefined;
        }
      } catch { return undefined; }
      return undefined;
    };
    this.getTurnstileToken = () => this.getCaptchaToken();

    this.attachCaptchaHeaders = (headers = {}) => {
      const token = this.getTurnstileToken();
      if (token) {
        headers['X-CF-Turnstile'] = token;
        headers['X-Human-Captcha'] = token;
      }
      return headers;
    };

    this.extendCaptchaPayload = (payload = {}) => {
      const token = this.getTurnstileToken();
      if (token) {
        return { ...payload, captchaToken: token, turnstileToken: token };
      }
      return payload;
    };
  }

  /**
   * 发送 MFA 挑战（发送邮件验证码）
   * @param {string} accessToken - 访问令牌
   * @returns {Promise<Object>} MFA Challenge Response
   */
  async sendMFAChallenge(accessToken) {
    Logger.log('[API] sendMFAChallenge: start', { hasToken: !!accessToken });
    const cookieValue = (typeof localStorage !== 'undefined' ? localStorage.getItem('giffgaff_cookie') : null) || undefined;
    const baseHeaders = {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
    };
    const makeBody = (extra = {}) => this.extendCaptchaPayload({
      ...(accessToken ? { accessToken } : {}),
      cookie: cookieValue,
      source: 'esim',
      preferredChannels: ['EMAIL'],
      ...extra
    });
    // 先检查令牌是否过期，如果过期则尝试使用cookie重新验证
    try {
      // 尝试使用现有令牌
      const response = await fetch(this.endpoints.mfaChallenge, {
        method: 'POST',
        headers: this.attachCaptchaHeaders({ ...baseHeaders }),
        body: JSON.stringify(makeBody())
      });
      
      // 如果响应成功，直接返回结果
      if (response.ok) {
        const json = await response.json();
        Logger.log('[API] sendMFAChallenge: ok', { hasRef: !!json?.ref });
        return json;
      }
      
      // 如果是401错误，可能是令牌过期
      const errorData = await response.json();
      console.warn('令牌可能过期，尝试重新验证cookie', errorData);
      
      // 检查是否是令牌过期错误
      if (response.status === 401 && 
          errorData?.details?.error === 'invalid_token' && 
          errorData?.details?.error_description === 'Access token expired') {
        
        // 尝试使用本地存储的cookie重新验证
          const cookie = cookieValue;
          if (cookie) {
            Logger.log('尝试使用cookie重新验证');
            const cookieVerifyResult = await this.verifyCookie(cookie);
          
          if (cookieVerifyResult.success && cookieVerifyResult.accessToken) {
            // 更新全局令牌
            const newAccessToken = cookieVerifyResult.accessToken;
            Logger.log('使用cookie重新验证成功，更新令牌');
            
            // 使用新令牌重新发送MFA请求
            const newResponse = await fetch(this.endpoints.mfaChallenge, {
              method: 'POST',
              headers: this.attachCaptchaHeaders({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${newAccessToken}`
              }),
              body: JSON.stringify(this.extendCaptchaPayload({
                accessToken: newAccessToken,
                cookie: cookieValue,
                source: 'esim',
                preferredChannels: ['EMAIL']
              }))
            });
            
            if (newResponse.ok) {
              // 返回数据并更新状态
              const result = await newResponse.json();
              // 通知调用者令牌已更新
              result._tokenRefreshed = true;
              result._newAccessToken = newAccessToken;
              return result;
            } else {
              const newErrorText = await newResponse.text();
              throw new Error(`MFA Challenge with refreshed token failed: ${newResponse.status} - ${newErrorText}`);
            }
          }
        }
      }
      
      // 如果无法刷新令牌或其他错误，抛出原始错误
      if (errorData && errorData.needReLogin) {
        throw new Error('登录过期，请重新使用Cookie登录');
      }
      throw new Error(`MFA Challenge failed: ${response.status} - ${JSON.stringify(errorData)}`);
    } catch (error) {
      console.error('[API] sendMFAChallenge: error', error);
      throw error;
    }
  }

  /**
   * 验证 MFA 代码
   * @param {string} accessToken - 访问令牌
   * @param {string} ref - MFA Reference
   * @param {string} code - 验证码
   * @returns {Promise<Object>} MFA Validation Response
   */
  async validateMFACode(accessToken, ref, code) {
    Logger.log('[API] validateMFACode: start', { hasToken: !!accessToken, ref: String(ref||'').slice(0,6)+'...' });
    const response = await fetch(this.endpoints.mfaValidation, {
      method: 'POST',
      headers: this.attachCaptchaHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }),
      body: JSON.stringify(this.extendCaptchaPayload({
        accessToken,
        ref: ref,
        code: code
      }))
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MFA Validation failed: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    Logger.log('[API] validateMFACode: ok', { hasSignature: !!json?.signature });
    return json;
  }

  /**
   * 一键短信验证码激活并获取LPA（后端编排）
   * - 输入: ref, code
   * - 可选: accessToken, cookie, memberId, ssn, activationCode
   * - 输出: { success, lpaString, token, ssn, activationCode }
   */
  async smsActivateFlow({ ref, code, accessToken, cookie, memberId, ssn, activationCode }) {
    Logger.log('[API] smsActivateFlow: start', { hasToken: !!accessToken, hasCookie: !!cookie, ref: String(ref||'').slice(0,6)+'...' });
    const resp = await fetch(this.endpoints.smsActivate, {
      method: 'POST',
      headers: this.attachCaptchaHeaders({ 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }),
      body: JSON.stringify(this.extendCaptchaPayload({ ref, code, accessToken, cookie: cookie || (typeof localStorage !== 'undefined' ? localStorage.getItem('giffgaff_cookie') : undefined), memberId, ssn, activationCode }))
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`SMS activate flow failed: ${resp.status} - ${t}`);
    }
    const json = await resp.json();
    Logger.log('[API] smsActivateFlow: ok', { success: !!json?.success, hasLpa: !!json?.lpaString });
    return json;
  }

  /**
   * 执行 GraphQL 查询
   * @param {string} accessToken - 访问令牌
   * @param {string} query - GraphQL 查询
   * @param {Object} variables - GraphQL 变量
   * @param {string} mfaSignature - MFA 签名（可选）
   * @returns {Promise<Object>} GraphQL Response
   */
  async graphqlQuery(accessToken, query, variables = {}, mfaSignature = null) {
    const opMatch = String(query||'').match(/(query|mutation)\s+(\w+)/i);
    const op = opMatch ? opMatch[2] : 'Unknown';
    Logger.log('[API] graphqlQuery: start', { op, hasToken: !!accessToken, hasSignature: !!mfaSignature });
    const response = await fetch(this.endpoints.graphql, {
      method: 'POST',
      headers: this.attachCaptchaHeaders({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }),
      body: JSON.stringify(this.extendCaptchaPayload({
        accessToken,
        cookie: (typeof localStorage !== 'undefined' ? localStorage.getItem('giffgaff_cookie') : null) || undefined,
        mfaSignature: mfaSignature || undefined,
        query,
        variables
      }))
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后重试（429）。建议在服务窗口内操作。');
      }
      if (response.status === 403) {
        throw new Error('权限不足或登录过期（403）。请重新登录或稍后再试。');
      }
      if (response.status === 408 || response.status === 504) {
        throw new Error('请求超时，请检查网络后重试。');
      }
      throw new Error(`GraphQL request failed: ${response.status} - ${text}`);
    }

    const data = await response.json();
    Logger.log('[API] graphqlQuery: ok', { op, hasErrors: !!data?.errors });
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data;
  }

  /**
   * 服务端代办 Token 交换
   * @param {string} code
   * @param {string} codeVerifier
   * @param {string} redirectUri 可选
   */
  async exchangeTokenServerSide(code, codeVerifier, redirectUri) {
    Logger.log('[API] tokenExchange: start');
    const turnstileToken = this.getTurnstileToken();
    const headers = this.attachCaptchaHeaders({ 'Content-Type': 'application/json' });
    const response = await fetch(this.endpoints.tokenExchange, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        ...(turnstileToken ? { turnstileToken, captchaToken: turnstileToken } : {})
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server token exchange failed: ${response.status} - ${errorText}`);
    }
    const json = await response.json();
    Logger.log('[API] tokenExchange: ok');
    return json;
  }

  /**
   * 获取会员信息
   * @param {string} accessToken - 访问令牌
   * @returns {Promise<Object>} Member Profile
   */
  async getMemberProfile(accessToken) {
    Logger.log('[API] getMemberProfile: start', { hasToken: !!accessToken });
    const query = `
      query getMemberProfileAndSim {
        memberProfile {
          id
          memberName
          __typename
        }
        sim {
          phoneNumber
          status
          __typename
        }
      }
    `;

    const res = await this.graphqlQuery(accessToken, query);
    Logger.log('[API] getMemberProfile: ok', { hasMember: !!res?.data?.memberProfile });
    return res;
  }

  /**
   * 预订 eSIM
   * @param {string} accessToken - 访问令牌
   * @param {string} memberId - 会员 ID
   * @param {string} mfaSignature - MFA 签名
   * @returns {Promise<Object>} Reserve eSIM Response
   */
  async reserveESIM(accessToken, memberId, mfaSignature) {
    Logger.log('[API] reserveESIM: start', { hasToken: !!accessToken, hasSignature: !!mfaSignature });
    const query = `
      mutation reserveESim($input: ESimReservationInput!) {
        reserveESim: reserveESim(input: $input) {
          id
          memberId
          reservationStartDate
          reservationEndDate
          status
          esim {
            ssn
            activationCode
            deliveryStatus
            associatedMemberId
            __typename
          }
          __typename
        }
      }
    `;

    const variables = {
      input: {
        memberId: memberId,
        userIntent: "SWITCH"
      }
    };

    const data = await this.graphqlQuery(accessToken, query, variables, mfaSignature);
    try {
      const esim = data?.data?.reserveESim?.esim;
      if (esim) {
        localStorage.setItem('gg_esim_activationCode', esim.activationCode || '');
        localStorage.setItem('gg_esim_ssn', esim.ssn || '');
      }
    } catch (_) {}
    Logger.log('[API] reserveESIM: ok', { hasESIM: !!data?.data?.reserveESim?.esim });
    return data;
  }

  /**
   * 获取 eSIM 下载令牌
   * @param {string} accessToken - 访问令牌
   * @param {string} ssn - eSIM SSN
   * @returns {Promise<Object>} eSIM Token Response
   */
  async getESIMToken(accessToken, ssn) {
    Logger.log('[API] getESIMToken: start', { hasToken: !!accessToken, hasSSN: !!ssn });
    const query = `
      query eSimDownloadToken($ssn: String!) {
        eSimDownloadToken(ssn: $ssn) {
          id
          host
          matchingId
          lpaString
          __typename
        }
      }
    `;

    const variables = {
      ssn: ssn
    };

    const data = await this.graphqlQuery(accessToken, query, variables);
    try {
      const lpa = data?.data?.eSimDownloadToken?.lpaString;
      if (lpa) localStorage.setItem('gg_esim_lpa', lpa);
    } catch (_) {}
    Logger.log('[API] getESIMToken: ok', { hasLPA: !!data?.data?.eSimDownloadToken?.lpaString });
    return data;
  }

  /**
   * 验证 Cookie
   * @param {string} cookie - Cookie 字符串
   * @returns {Promise<Object>} Cookie Verification Response
   */
  async verifyCookie(cookie) {
    Logger.log('[API] verifyCookie: start', { hasCookie: !!cookie });
    const response = await fetch(this.endpoints.cookieVerify, {
      method: 'POST',
      headers: this.attachCaptchaHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(this.extendCaptchaPayload({
        cookie: cookie
      }))
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cookie verification failed: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    Logger.log('[API] verifyCookie: ok', { success: !!json?.success });
    return json;
  }

  /**
   * 自动激活 eSIM
   * @param {string} activationCode - 激活码
   * @returns {Promise<Object>} Auto Activation Response
   */
  async autoActivateESIM(activationCode) {
    Logger.log('[API] autoActivateESIM: start', { hasCode: !!activationCode });
    const response = await fetch(this.endpoints.autoActivate, {
      method: 'POST',
      headers: this.attachCaptchaHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(this.extendCaptchaPayload({
        activationCode: activationCode
      }))
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Auto activation failed: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    Logger.log('[API] autoActivateESIM: ok', { success: !!json?.success });
    return json;
  }
}

export default new APIManager();
