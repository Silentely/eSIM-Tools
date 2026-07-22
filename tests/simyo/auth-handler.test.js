'use strict';

/**
 * Simyo AuthHandler：登录 + 登录 MFA（verifyOTP）
 */

import {
  authHandler,
  isMfaDisabledOrComplete,
  isMfaPending
} from '../../src/simyo/js/modules/auth-handler.js';
import { stateManager } from '../../src/simyo/js/modules/state-manager.js';
import { getApiEndpoints } from '../../src/simyo/js/modules/api-config.js';

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

  it('老用户未开 MFA（DISABLED_BY_CUSTOMER）应直接正式会话、跳过 MFA', async () => {
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
    expect(result.needsMfa).toBe(false);
    expect(result.sessionToken).toBe('sess-abc');
    expect(stateManager.get('sessionToken')).toBe('sess-abc');
    expect(stateManager.get('phoneNumber')).toBe('0612345678');
    expect(stateManager.get('mfaStatus')).toBe('DISABLED_BY_CUSTOMER');
    expect(stateManager.get('mfaPending')).toBe(false);
    expect(stateManager.get('password')).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(stateManager.getState(), 'password')).toBe(false);
    expect(authHandler.isLoggedIn()).toBe(true);
    // 未开 MFA 时不应请求 verifyOTP
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toMatch(/sessions/);
  });

  it('老用户 mfaStatus 为空时也应视为无需 MFA（兼容缺字段）', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        result: {
          sessionToken: 'sess-legacy-empty'
        }
      })
    });

    const result = await authHandler.login('0612345678', 'secret');
    expect(result.needsMfa).toBe(false);
    expect(stateManager.get('mfaPending')).toBe(false);
    expect(stateManager.get('sessionToken')).toBe('sess-legacy-empty');
    expect(authHandler.isLoggedIn()).toBe(true);
  });

  it('NOT_REQUIRED 不得被 REQUIRED 子串误判为需要 MFA', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        result: {
          sessionToken: 'sess-not-req',
          mfaStatus: 'NOT_REQUIRED'
        }
      })
    });

    const result = await authHandler.login('0612345678', 'secret');
    expect(result.needsMfa).toBe(false);
    expect(authHandler.isLoggedIn()).toBe(true);
  });

  it('新用户默认 MFA（PENDING_VERIFICATION）应 needsMfa，临时 token 不视为已登录', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        result: {
          sessionToken: 'sess-temp',
          mfaStatus: 'PENDING_VERIFICATION',
          mfaMethod: 'EMAIL',
          methodHint: 'e***@example.com'
        }
      })
    });

    const result = await authHandler.login('0612345678', 'secret');

    expect(result.success).toBe(true);
    expect(result.needsMfa).toBe(true);
    expect(result.sessionToken).toBe('sess-temp');
    expect(result.methodHint).toBe('e***@example.com');
    expect(stateManager.get('sessionToken')).toBe('sess-temp');
    expect(stateManager.get('mfaPending')).toBe(true);
    expect(authHandler.isLoggedIn()).toBe(false);
  });

  it('REQUIRED 状态也应走 MFA 路径而非抛错', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        result: {
          sessionToken: 'sess-mfa',
          mfaStatus: 'REQUIRED',
          mfaMethod: 'SMS',
          methodHint: '06****78'
        }
      })
    });

    const result = await authHandler.login('0612345678', 'secret');
    expect(result.needsMfa).toBe(true);
    expect(stateManager.get('mfaPending')).toBe(true);
    expect(authHandler.isLoggedIn()).toBe(false);
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

  it('verifyLoginOtp 成功后写入正式 token 并清除 mfaPending', async () => {
    stateManager.setState({
      sessionToken: 'sess-temp',
      phoneNumber: '0612345678',
      mfaPending: true,
      mfaStatus: 'PENDING_VERIFICATION'
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        result: {
          token: 'formal-session-token-xyz'
        }
      })
    });

    const result = await authHandler.verifyLoginOtp('123456');

    expect(result.success).toBe(true);
    expect(result.sessionToken).toBe('formal-session-token-xyz');
    expect(stateManager.get('sessionToken')).toBe('formal-session-token-xyz');
    expect(stateManager.get('mfaPending')).toBe(false);
    expect(authHandler.isLoggedIn()).toBe(true);

    const call = global.fetch.mock.calls[0];
    expect(call[0]).toContain('/api/simyo/v2/security.verifyOTP');
    expect(call[1].method).toBe('POST');
    const body = JSON.parse(call[1].body);
    expect(body).toEqual({ rememberMe: true, token: '123456' });
    expect(call[1].headers['X-Session-Token']).toBe('sess-temp');
  });

  it('verifyLoginOtp 非 6 位应抛错且不请求', async () => {
    stateManager.setState({ sessionToken: 'sess-temp', mfaPending: true });
    await expect(authHandler.verifyLoginOtp('12')).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('verifyLoginOtp 缺少正式 token 应抛错', async () => {
    stateManager.setState({ sessionToken: 'sess-temp', mfaPending: true });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ result: {} })
    });
    await expect(authHandler.verifyLoginOtp('123456')).rejects.toThrow();
    expect(stateManager.get('mfaPending')).toBe(true);
  });

  it('isMfaDisabledOrComplete / isMfaPending 识别老用户与新用户状态', () => {
    // 老用户未开 MFA
    expect(isMfaDisabledOrComplete('DISABLED_BY_CUSTOMER')).toBe(true);
    expect(isMfaPending('DISABLED_BY_CUSTOMER')).toBe(false);
    expect(isMfaDisabledOrComplete('')).toBe(true);
    expect(isMfaPending('')).toBe(false);
    expect(isMfaPending(null)).toBe(false);
    // 勿把 NOT_REQUIRED 判成 pending
    expect(isMfaDisabledOrComplete('NOT_REQUIRED')).toBe(true);
    expect(isMfaPending('NOT_REQUIRED')).toBe(false);
    // 新用户 / 已开 MFA
    expect(isMfaPending('PENDING_VERIFICATION')).toBe(true);
    expect(isMfaPending('REQUIRED')).toBe(true);
    expect(isMfaDisabledOrComplete('REQUIRED')).toBe(false);
    expect(isMfaPending('ENABLED')).toBe(true);
  });

  it('getApiEndpoints 应包含 v2 verifyOtp', () => {
    const endpoints = getApiEndpoints();
    expect(endpoints.verifyOtp).toMatch(/\/api\/simyo\/v2\/security\.verifyOTP$/);
  });
});
