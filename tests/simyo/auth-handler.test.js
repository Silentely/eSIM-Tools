'use strict';

/**
 * Simyo AuthHandler 冒烟测试
 */

import { authHandler, isMfaDisabledOrComplete } from '../../src/simyo/js/modules/auth-handler.js';
import { stateManager } from '../../src/simyo/js/modules/state-manager.js';

describe('Simyo AuthHandler', () => {
  beforeEach(() => {
    stateManager.clearSession();
    global.fetch.mockReset();
  });

  it('非法手机号应直接抛错且不发起请求', async () => {
    await expect(authHandler.login('123', 'secret')).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('缺少密码应直接抛错且不发起请求', async () => {
    await expect(authHandler.login('0612345678', '')).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('登录成功应写入 token/手机号，且不保留 password', async () => {
    // 官方 HAR 形态：无顶层 success，result 内无 success 字段
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        result: {
          sessionToken: 'sess-abc',
          mfaStatus: 'DISABLED_BY_CUSTOMER',
          mfaMethod: '',
          methodHint: ''
        }
      })
    });

    const result = await authHandler.login('0612345678', 'super-secret');

    expect(result.success).toBe(true);
    expect(result.sessionToken).toBe('sess-abc');
    expect(stateManager.get('sessionToken')).toBe('sess-abc');
    expect(stateManager.get('phoneNumber')).toBe('0612345678');
    expect(stateManager.get('mfaStatus')).toBe('DISABLED_BY_CUSTOMER');
    expect(stateManager.get('password')).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(stateManager.getState(), 'password')).toBe(false);
    expect(authHandler.isLoggedIn()).toBe(true);
  });

  it('MFA 未关闭时应阻断并提示', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        result: {
          sessionToken: 'sess-mfa',
          mfaStatus: 'REQUIRED',
          mfaMethod: 'EMAIL',
          methodHint: 'email'
        }
      })
    });

    await expect(authHandler.login('0612345678', 'secret')).rejects.toThrow(/MFA|二次验证|mfa/i);
    expect(stateManager.get('sessionToken')).toBe('sess-mfa');
  });

  it('响应缺少 sessionToken 应抛错', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        result: {},
        message: 'no token'
      })
    });

    await expect(authHandler.login('0612345678', 'secret')).rejects.toThrow();
    expect(stateManager.get('sessionToken')).toBe('');
  });

  it('isMfaDisabledOrComplete 识别官方 DISABLED_BY_CUSTOMER', () => {
    expect(isMfaDisabledOrComplete('DISABLED_BY_CUSTOMER')).toBe(true);
    expect(isMfaDisabledOrComplete('REQUIRED')).toBe(false);
    expect(isMfaDisabledOrComplete('')).toBe(true);
  });
});
