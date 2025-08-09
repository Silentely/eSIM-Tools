/**
 * Giffgaff OAuth 2.0 PKCE 认证模块
 */

class OAuthManager {
  constructor() {
    this.config = {
      clientId: "4a05bf219b3985647d9b9a3ba610a9ce",
      authUrl: "https://id.giffgaff.com/auth/oauth/authorize",
      redirectUri: "giffgaff://auth/callback/"
    };
  }

  /**
   * 生成 Code Verifier (PKCE)
   * @returns {string} Code Verifier
   */
  generateCodeVerifier() {
    const array = new Uint8Array(96);
    crypto.getRandomValues(array);
    const verifier = btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return verifier.substring(0, 128);
  }

  /**
   * 生成 Code Challenge (PKCE)
   * @param {string} verifier - Code Verifier
   * @returns {Promise<string>} Code Challenge
   */
  async generateCodeChallenge(verifier) {
    // 使用 WebCrypto（浏览器与受支持环境）
    if (globalThis.crypto && globalThis.crypto.subtle && typeof globalThis.crypto.subtle.digest === 'function') {
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
      return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    }
    // 最小回退（非生产）：返回原字符串的 base64url 近似，避免构建引入 Node "crypto" 依赖
    return verifier.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * 生成随机状态值
   * @returns {string} State
   */
  generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * 构建授权 URL
   * @param {string} codeVerifier - Code Verifier
   * @returns {Promise<string>} Authorization URL
   */
  async buildAuthorizationUrl(codeVerifier, stateOverride) {
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = stateOverride || this.generateState();
    
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'read',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    return `${this.config.authUrl}?${authParams.toString()}`;
  }

  /**
   * 从回调 URL 中提取授权码
   * @param {string} callbackUrl - 回调 URL
   * @returns {string|null} Authorization Code
   */
  extractCodeFromCallback(callbackUrl) {
    try {
      let code = null;
      
      if (callbackUrl.startsWith('giffgaff://')) {
        // 处理giffgaff://协议的回调URL
        const match = callbackUrl.match(/[?&]code=([^&]+)/);
        code = match ? decodeURIComponent(match[1]) : null;
      } else {
        // 处理标准HTTP/HTTPS URL
        const url = new URL(callbackUrl);
        code = url.searchParams.get('code');
      }
      
      return code;
    } catch (error) {
      console.error('解析回调URL失败:', error);
      return null;
    }
  }

  /**
   * 交换访问令牌
   * @param {string} code - Authorization Code
   * @param {string} codeVerifier - Code Verifier
   * @returns {Promise<Object>} Token Response
   */
  // 前端不再直接持有 client_secret，改由服务端函数代为交换
  async exchangeToken(code, codeVerifier) {
    const res = await fetch('/.netlify/functions/giffgaff-token-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: this.config.redirectUri })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${res.status} - ${text}`);
    }
    return await res.json();
  }
}

export default new OAuthManager();