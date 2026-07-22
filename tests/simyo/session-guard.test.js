'use strict';

/**
 * Simyo requireSessionToken 公共守卫
 */

import { requireSessionToken } from '../../src/simyo/js/modules/session-guard.js';
import { stateManager } from '../../src/simyo/js/modules/state-manager.js';
import { esimService } from '../../src/simyo/js/modules/esim-service.js';

describe('Simyo session-guard', () => {
  beforeEach(() => {
    stateManager.clearSession();
    global.fetch.mockReset();
  });

  it('无 session 应抛 requireLogin', () => {
    expect(() => requireSessionToken()).toThrow(/login|登录|sign in/i);
  });

  it('mfaPending 时应拒绝业务会话', () => {
    stateManager.setState({ sessionToken: 'temp', mfaPending: true });
    expect(() => requireSessionToken()).toThrow(/MFA|二次验证|verification|验证码/i);
  });

  it('正式会话应返回 token', () => {
    stateManager.setState({ sessionToken: 'formal-ok', mfaPending: false });
    expect(requireSessionToken()).toBe('formal-ok');
  });

  it('esimService.getEsim 在 mfaPending 时不发起请求', async () => {
    stateManager.setState({ sessionToken: 'temp', mfaPending: true });
    await expect(esimService.getEsim()).rejects.toThrow(/MFA|二次验证|verification|验证码/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
