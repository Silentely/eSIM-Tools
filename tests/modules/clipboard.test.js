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

    const result = await copyToClipboard('hello-esim');

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello-esim');
    expect(result).toEqual({ method: 'clipboard' });
  });

  it('clipboard 因页面失焦失败时应降级到 execCommand', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });
    navigator.clipboard.writeText.mockRejectedValueOnce(
      new DOMException('Document is not focused.', 'NotAllowedError')
    );
    document.execCommand = jest.fn(() => true);

    const result = await copyToClipboard('from-devtools');

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('from-devtools');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result).toEqual({ method: 'execCommand' });
    expect(document.body.querySelector('textarea')).toBeNull();
  });

  it('非安全上下文应降级到 execCommand', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false
    });
    document.execCommand = jest.fn(() => true);

    const result = await copyToClipboard('fallback-text');

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result).toEqual({ method: 'execCommand' });
    expect(document.body.querySelector('textarea')).toBeNull();
  });

  it('两种方式都失败时应抛出 ClipboardError', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });
    navigator.clipboard.writeText.mockRejectedValueOnce(
      new DOMException('Document is not focused.', 'NotAllowedError')
    );
    document.execCommand = jest.fn(() => false);

    await expect(copyToClipboard('nope')).rejects.toMatchObject({
      name: 'ClipboardError'
    });
  });
});
