/**
 * Simyo 设备更换处理模块集成测试（对齐 HAR 状态机，仅 EMAIL）
 */

import { deviceChangeHandler, ESIM_STATUS } from '../../src/simyo/js/modules/device-change-handler.js';
import { stateManager } from '../../src/simyo/js/modules/state-manager.js';

describe('Simyo DeviceChangeHandler 集成覆盖', () => {
  beforeEach(() => {
    stateManager.clearSession();
    stateManager.set('sessionToken', 'test-session-token');
    global.fetch.mockReset();
  });

  it('应完成设备更换主流程：GET simcard → POST simcard → verifyCode', async () => {
    const jsonHeaders = { get: (name) => (name === 'content-type' ? 'application/json' : null) };
    global.fetch
      // GET status
      .mockResolvedValueOnce({
        headers: jsonHeaders,
        ok: true,
        json: async () => ({
          result: {
            eSimStatus: ESIM_STATUS.START_REQUEST,
            canCreateESim: 'Available',
            remainingNumberOfTries: 3
          }
        })
      })
      // POST apply
      .mockResolvedValueOnce({
        headers: jsonHeaders,
        ok: true,
        json: async () => ({
          result: {
            success: true,
            reason: 'Available',
            remainingNumberOfTries: 3
          }
        })
      })
      // verify
      .mockResolvedValueOnce({
        headers: jsonHeaders,
        ok: true,
        json: async () => ({
          result: {
            success: true,
            remainingNumberOfTries: 2
          }
        })
      });

    const applyResult = await deviceChangeHandler.applyNewEsim();
    const verifyResult = await deviceChangeHandler.verifyCode('123456');

    expect(applyResult.success).toBe(true);
    expect(applyResult.reason).toBe('Available');
    expect(verifyResult.success).toBe(true);
    expect(stateManager.get('validationCode')).toBe('123456');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/api/simyo/settings/simcard',
      expect.objectContaining({ method: 'GET' })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/simyo/settings/simcard',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ initialValidationMethod: 'EMAIL', esim: true })
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      '/api/simyo/esim/verify-code',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('已在等待验证码时应跳过重复 POST', async () => {
    const jsonHeaders = { get: (name) => (name === 'content-type' ? 'application/json' : null) };
    global.fetch.mockResolvedValueOnce({
      headers: jsonHeaders,
      ok: true,
      json: async () => ({
        result: {
          eSimStatus: ESIM_STATUS.WAITING_FOR_VALIDATION_CODE,
          canCreateESim: 'AlreadyOrderedSimcardEsim',
          remainingNumberOfTries: 2
        }
      })
    });

    const applyResult = await deviceChangeHandler.applyNewEsim();
    expect(applyResult.success).toBe(true);
    expect(applyResult.alreadyPending).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/simyo/settings/simcard',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('已 READY_FOR_DOWNLOAD 时应提示可直接获取 eSIM', async () => {
    const jsonHeaders = { get: (name) => (name === 'content-type' ? 'application/json' : null) };
    global.fetch.mockResolvedValueOnce({
      headers: jsonHeaders,
      ok: true,
      json: async () => ({
        result: {
          eSimStatus: ESIM_STATUS.READY_FOR_DOWNLOAD,
          remainingNumberOfTries: 2
        }
      })
    });

    const applyResult = await deviceChangeHandler.applyNewEsim();
    expect(applyResult.readyForDownload).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
