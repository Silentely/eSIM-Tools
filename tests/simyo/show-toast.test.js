'use strict';

/**
 * Simyo showToast XSS 防护测试
 */

import { showToast } from '../../src/simyo/js/modules/utils.js';

describe('Simyo showToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('应把消息渲染为文本而不是 HTML', () => {
    showToast('<img src=x onerror=alert(1)>');

    const toast = document.querySelector('.toast-notification');
    expect(toast).toBeTruthy();
    expect(toast.querySelector('img[src="x"]')).toBeNull();
    expect(toast.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('null/undefined 消息不应抛错', () => {
    expect(() => showToast(null)).not.toThrow();
    expect(() => showToast(undefined)).not.toThrow();
  });
});
