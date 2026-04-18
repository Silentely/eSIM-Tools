/**
 * Simyo 设备更换处理模块集成测试
 */

import { deviceChangeHandler } from '../../src/simyo/js/modules/device-change-handler.js';
import { stateManager } from '../../src/simyo/js/modules/state-manager.js';

describe('Simyo DeviceChangeHandler 集成覆盖', () => {
  beforeEach(() => {
    stateManager.clearSession();
    stateManager.set('sessionToken', 'test-session-token');
    global.fetch.mockReset();
  });

  it('应完成设备更换主流程：applyNewEsim -> verifyCode', async () => {
    global.fetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          result: {
            message: 'apply success',
            remainingNumberOfTries: 3
          }
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          result: {
            message: 'verify success',
            remainingNumberOfTries: 2
          }
        })
      });

    const applyResult = await deviceChangeHandler.applyNewEsim();
    const verifyResult = await deviceChangeHandler.verifyCode('123456');

    expect(applyResult.success).toBe(true);
    expect(verifyResult.success).toBe(true);
    expect(stateManager.get('validationCode')).toBe('123456');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/simyo/settings/simcard',
      expect.objectContaining({ method: 'POST' })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/simyo/esim/verify-code',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sendSmsCode 在 SMS 可用时应调用官方发送接口', async () => {
    global.fetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          result: {
            availableMethods: ['SMS']
          }
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          result: {
            message: 'sms sent',
            nextStep: 'next'
          }
        })
      });

    const result = await deviceChangeHandler.sendSmsCode();

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/simyo/esim.availableValidationMethods',
      expect.objectContaining({ method: 'POST' })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/simyo/esim/send-sms-code',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sendSmsCode 在邮箱流程且短信接口失败时应回退为邮箱提示', async () => {
    global.fetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          result: {
            availableMethods: ['EMAIL']
          }
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: false,
          message: 'sms endpoint unsupported'
        })
      });

    const result = await deviceChangeHandler.sendSmsCode();

    expect(result.success).toBe(true);
    expect(result.message).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

