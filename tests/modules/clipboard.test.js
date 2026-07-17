'use strict';

/**
 * clipboard 模块单元测试
 */

import { copyToClipboard } from '../../src/js/modules/clipboard.js';

describe('copyToClipboard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('在安全上下文中应使用 navigator.clipboard.writeText', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });
    navigator.clipboard.writeText.mockResolvedValueOnce(undefined);

    await copyToClipboard('hello-esim');

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello-esim');
  });

  it('非安全上下文应降级到 execCommand', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false
    });
    document.execCommand = jest.fn(() => true);

    await copyToClipboard('fallback-text');

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.body.querySelector('textarea')).toBeNull();
  });
});
