'use strict';

/**
 * Giffgaff OAuthHandler 冒烟测试（回调与 token 交换）
 */

import { oauthHandler } from '../../src/giffgaff/js/modules/oauth-handler.js';
import { stateManager } from '../../src/giffgaff/js/modules/state-manager.js';

describe('Giffgaff OAuthHandler.processCallback', () => {
  beforeEach(() => {
    stateManager.setState({
      accessToken: '',
      codeVerifier: ''
    });
    global.fetch.mockReset();
  });

  it('缺少 code 应抛错', async () => {
    await expect(
      oauthHandler.processCallback('https://example.com/callback?state=abc')
    ).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('缺少 code verifier 应抛错', async () => {
    await expect(
      oauthHandler.processCallback('https://example.com/callback?code=auth-code&state=s1')
    ).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('应使用 giffgaff:// 回调解析 code 并交换 token', async () => {
    stateManager.set('codeVerifier', 'a'.repeat(43));
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'tok-123' })
    });

    const result = await oauthHandler.processCallback(
      'giffgaff://auth/callback/?code=abc%20123&state=st1'
    );

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('tok-123');
    expect(stateManager.get('accessToken')).toBe('tok-123');
    expect(global.fetch).toHaveBeenCalledWith(
      '/bff/giffgaff-token-exchange',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"code":"abc 123"')
      })
    );
  });

  it('token 交换 HTTP 失败应抛错', async () => {
    stateManager.set('codeVerifier', 'a'.repeat(43));
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    await expect(
      oauthHandler.processCallback('https://example.com/cb?code=x&state=y')
    ).rejects.toThrow();
  });
});
