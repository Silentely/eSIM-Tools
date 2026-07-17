'use strict';

/**
 * Giffgaff PKCE 工具函数测试
 */

import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState
} from '../../src/giffgaff/js/modules/utils.js';

describe('Giffgaff PKCE utils', () => {
  beforeEach(() => {
    // 确保 PKCE 所需的 WebCrypto 在 jsdom 下可用
    const subtle = {
      digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32)))
    };
    const webcrypto = {
      getRandomValues: (arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      subtle
    };
    Object.defineProperty(global, 'crypto', { configurable: true, value: webcrypto });
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
    }
  });

  it('generateCodeVerifier 长度应在 43–128 且为 base64url', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('generateCodeChallenge 应返回 base64url 字符串', async () => {
    const challenge = await generateCodeChallenge('test-verifier-abcdefghijklmnopqrstuvwxyz0123456789');
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('generateState 应为非空 base64url', () => {
    const state = generateState();
    expect(state.length).toBeGreaterThan(0);
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});
