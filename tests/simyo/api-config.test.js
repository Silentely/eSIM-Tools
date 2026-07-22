'use strict';

/**
 * Simyo api-config：请求头与设备 ID（对齐官方 App 抓包）
 */

import {
  createHeaders,
  getOrCreateDeviceId,
  simyoConfig
} from '../../src/simyo/js/modules/api-config.js';

const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

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
    expect(headers['X-Client-Platform']).toBe('ios');
    expect(headers['X-Client-Version']).toBe('4.28.0');
    expect(headers['X-Device-ID']).toMatch(UUID_RE);
    expect(headers['User-Agent']).toBe(simyoConfig.userAgent);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('application/json');
    expect(headers['X-Session-Token']).toBeUndefined();
  });

  it('includeSession 时应附带 X-Session-Token', () => {
    const headers = createHeaders(true, 'sess-token-1');
    expect(headers['X-Session-Token']).toBe('sess-token-1');
    expect(headers['X-Device-ID']).toMatch(UUID_RE);
  });
});
