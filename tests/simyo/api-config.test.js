'use strict';

/**
 * Simyo api-config / client-identity：请求头与设备身份
 */

import {
  createHeaders,
  getOrCreateDeviceId,
  handleApiResponse,
  mapSimyoErrorMessage,
  simyoConfig
} from '../../src/simyo/js/modules/api-config.js';
import {
  SIMYO_CLIENT_PLATFORM,
  SIMYO_CLIENT_VERSION,
  SIMYO_DEVICE_MODEL,
  SIMYO_IOS_VERSION,
  SIMYO_USER_AGENT,
  simyoClientIdentity
} from '../../src/simyo/js/modules/client-identity.js';

const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
/** 官方抓包 UA：版本号后恰好两个空格 */
const EXPECTED_UA = 'MijnSimyoFT/4.28.0  (iOS 18.2; iPhone12,8)';

describe('Simyo client-identity', () => {
  it('版本 / 设备 / UA 应与 client-identity 常量一致', () => {
    expect(SIMYO_CLIENT_VERSION).toBe('4.28.0');
    expect(SIMYO_CLIENT_PLATFORM).toBe('ios');
    expect(SIMYO_IOS_VERSION).toBe('18.2');
    expect(SIMYO_DEVICE_MODEL).toBe('iPhone12,8');
    expect(SIMYO_USER_AGENT).toBe(EXPECTED_UA);
    // 版本号与括号之间必须是两个空格
    expect(SIMYO_USER_AGENT).toMatch(/^MijnSimyoFT\/4\.28\.0 {2}\(iOS 18\.2; iPhone12,8\)$/);
    expect(simyoClientIdentity.userAgent).toBe(EXPECTED_UA);
  });
});

describe('Simyo api-config headers', () => {
  beforeEach(() => {
    localStorage.clear();
    delete getOrCreateDeviceId._sessionId;
  });

  it('应生成并持久化大写 UUID 形态的 X-Device-ID', () => {
    const id1 = getOrCreateDeviceId();
    const id2 = getOrCreateDeviceId();
    expect(id1).toMatch(UUID_RE);
    expect(id2).toBe(id1);
    expect(localStorage.getItem('simyo_device_id')).toBe(id1);
  });

  it('createHeaders 必须包含核心身份头', () => {
    const headers = createHeaders(false);
    expect(headers['X-Client-Token']).toBe(simyoConfig.clientToken);
    expect(headers['X-Client-Platform']).toBe(SIMYO_CLIENT_PLATFORM);
    expect(headers['X-Client-Version']).toBe(SIMYO_CLIENT_VERSION);
    expect(headers['X-Device-ID']).toMatch(UUID_RE);
    expect(headers['User-Agent']).toBe(EXPECTED_UA);
    expect(headers['User-Agent']).toBe(simyoConfig.userAgent);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('application/json');
    expect(headers['X-Session-Token']).toBeUndefined();
  });

  it('includeSession 时应附带 X-Session-Token', () => {
    const headers = createHeaders(true, 'sess-token-1');
    expect(headers['X-Session-Token']).toBe('sess-token-1');
    expect(headers['X-Device-ID']).toMatch(UUID_RE);
    expect(headers['User-Agent']).toBe(EXPECTED_UA);
  });
});

describe('Simyo mapSimyoErrorMessage / handleApiResponse', () => {
  it('426 应映射为升级客户端友好文案，而不是 HTTP 426', () => {
    const msg = mapSimyoErrorMessage(426, {});
    expect(msg).not.toMatch(/HTTP\s*426/i);
    expect(msg.toLowerCase()).toMatch(/upgrade|升级|客户端|client version|refresh|刷新/);
  });

  it('missing X-Device-ID 应映射为设备标识提示', () => {
    const msg = mapSimyoErrorMessage(400, { message: 'missing X-Device-ID' });
    expect(msg.toLowerCase()).toMatch(/device|设备|x-device-id/);
    expect(msg).not.toBe('missing X-Device-ID');
  });

  it('bad session 应映射为会话无效，而非账号密码错误', () => {
    const msg = mapSimyoErrorMessage(401, { message: 'Unauthorised - bad session' });
    expect(msg.toLowerCase()).toMatch(/session|会话|mfa|bad session/);
    expect(msg).not.toMatch(/密码不正确|incorrect phone number or password/i);
  });

  it('401 凭据错误原文应优先识别为账号密码错误', () => {
    const msg = mapSimyoErrorMessage(401, { message: 'Invalid credentials' });
    expect(msg.toLowerCase()).toMatch(/password|密码|phone|手机号|incorrect|不正确/);
  });

  it('handleApiResponse 在 426 时应抛出友好错误', async () => {
    const response = {
      ok: false,
      status: 426,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Upgrade Required' })
    };
    await expect(handleApiResponse(response)).rejects.toThrow(/升级|upgrade|客户端|client version|refresh|刷新/i);
  });

  it('handleApiResponse 登录体无 result.success 但有 sessionToken 应视为成功', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        result: {
          sessionToken: 'abc',
          mfaStatus: 'DISABLED_BY_CUSTOMER'
        }
      })
    };
    const data = await handleApiResponse(response);
    expect(data.success).toBe(true);
    expect(data.result.sessionToken).toBe('abc');
  });

  it('handleApiResponse 成功路径仍返回 result', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, result: { sessionToken: 'abc' } })
    };
    const data = await handleApiResponse(response);
    expect(data.success).toBe(true);
    expect(data.result.sessionToken).toBe('abc');
  });
});
