'use strict';

/**
 * Simyo api-config / client-identity：请求头与设备身份（对齐官方 App 抓包）
 */

import {
  createHeaders,
  getOrCreateDeviceId,
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
const OFFICIAL_UA = 'MijnSimyoFT/4.28.0  (iOS 27.0; iPhone16,1)';

describe('Simyo client-identity', () => {
  it('版本 / 设备 / UA 应与 4.28.0 抓包完全一致', () => {
    expect(SIMYO_CLIENT_VERSION).toBe('4.28.0');
    expect(SIMYO_CLIENT_PLATFORM).toBe('ios');
    expect(SIMYO_IOS_VERSION).toBe('27.0');
    expect(SIMYO_DEVICE_MODEL).toBe('iPhone16,1');
    expect(SIMYO_USER_AGENT).toBe(OFFICIAL_UA);
    // 版本号与括号之间必须是两个空格（不是一个）
    expect(SIMYO_USER_AGENT).toMatch(/^MijnSimyoFT\/4\.28\.0 {2}\(iOS 27\.0; iPhone16,1\)$/);
    expect(simyoClientIdentity.userAgent).toBe(OFFICIAL_UA);
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

  it('createHeaders 必须包含官方抓包中的核心头', () => {
    const headers = createHeaders(false);
    expect(headers['X-Client-Token']).toBe(simyoConfig.clientToken);
    expect(headers['X-Client-Platform']).toBe(SIMYO_CLIENT_PLATFORM);
    expect(headers['X-Client-Version']).toBe(SIMYO_CLIENT_VERSION);
    expect(headers['X-Device-ID']).toMatch(UUID_RE);
    expect(headers['User-Agent']).toBe(OFFICIAL_UA);
    expect(headers['User-Agent']).toBe(simyoConfig.userAgent);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('application/json');
    expect(headers['X-Session-Token']).toBeUndefined();
  });

  it('includeSession 时应附带 X-Session-Token', () => {
    const headers = createHeaders(true, 'sess-token-1');
    expect(headers['X-Session-Token']).toBe('sess-token-1');
    expect(headers['X-Device-ID']).toMatch(UUID_RE);
    expect(headers['User-Agent']).toBe(OFFICIAL_UA);
  });
});
