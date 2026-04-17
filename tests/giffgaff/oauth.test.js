/**
 * Giffgaff OAuth 管理模块测试
 */

import OAuthManager from '../../src/js/modules/giffgaff/oauth';

describe('Giffgaff OAuthManager', () => {
  describe('generateCodeVerifier()', () => {
    it('应该生成有效的 code verifier', () => {
      const verifier = OAuthManager.generateCodeVerifier();

      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
      // 检查是否符合 PKCE 规范字符集
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });

    it('每次生成的 verifier 应该不同', () => {
      const verifier1 = OAuthManager.generateCodeVerifier();
      const verifier2 = OAuthManager.generateCodeVerifier();

      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe('generateCodeChallenge()', () => {
    it('应该从 verifier 生成有效的 challenge', async () => {
      const verifier = 'test-verifier-string';
      const challenge = await OAuthManager.generateCodeChallenge(verifier);

      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      // 检查是否为 base64url 编码
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    });
  });

  describe('generateState()', () => {
    it('应该生成有效的 state 参数', () => {
      const state = OAuthManager.generateState();

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
      // 检查是否为 base64url 编码
      expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it('每次生成的 state 应该不同', () => {
      const state1 = OAuthManager.generateState();
      const state2 = OAuthManager.generateState();

      expect(state1).not.toBe(state2);
    });
  });

  describe('buildAuthorizationUrl()', () => {
    it('应该构建正确的授权 URL', async () => {
      const verifier = 'test-verifier';
      const url = await OAuthManager.buildAuthorizationUrl(verifier);

      expect(url).toContain('https://id.giffgaff.com/oauth/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=read');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('state=');
    });
  });

  describe('extractCodeFromCallback()', () => {
    it('应该从标准 URL 提取授权码', () => {
      const callbackUrl = 'https://example.com/callback?code=test-code&state=test-state';
      const code = OAuthManager.extractCodeFromCallback(callbackUrl);

      expect(code).toBe('test-code');
    });

    it('应该从 giffgaff:// 协议 URL 提取授权码', () => {
      const callbackUrl = 'giffgaff://auth/callback/?code=test-code&state=test-state';
      const code = OAuthManager.extractCodeFromCallback(callbackUrl);

      expect(code).toBe('test-code');
    });

    it('应该处理编码的授权码', () => {
      const callbackUrl = 'https://example.com/callback?code=test%2Bcode%3D&state=test';
      const code = OAuthManager.extractCodeFromCallback(callbackUrl);

      expect(code).toBe('test+code=');
    });

    it('应该在没有授权码时返回 null', () => {
      const callbackUrl = 'https://example.com/callback?state=test-state';
      const code = OAuthManager.extractCodeFromCallback(callbackUrl);

      expect(code).toBeNull();
    });

    it('应该处理无效的 URL', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const callbackUrl = 'not-a-valid-url';
      try {
        const code = OAuthManager.extractCodeFromCallback(callbackUrl);
        expect(code).toBeNull();
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('exchangeToken()', () => {
    beforeEach(() => {
      global.fetch.mockClear();
    });

    it('应该成功交换访问令牌', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await OAuthManager.exchangeToken('test-code', 'test-verifier');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/.netlify/functions/giffgaff-token-exchange',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: expect.any(String)
        })
      );
    });

    it('应该处理令牌交换失败', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid grant'
      });

      await expect(
        OAuthManager.exchangeToken('invalid-code', 'test-verifier')
      ).rejects.toThrow('Token exchange failed: 400 - Invalid grant');
    });
  });
});
