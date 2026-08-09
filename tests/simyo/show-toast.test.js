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

  it('默认类型显示成功图标', () => {
    showToast('复制成功');

    const toast = document.querySelector('.toast-notification');
    expect(toast.querySelector('.fa-check-circle')).toBeTruthy();
  });

  it('error 类型显示错误图标', () => {
    showToast('复制失败，请手动选择文本复制', 'error');

    const toast = document.querySelector('.toast-notification');
    expect(toast.querySelector('.fa-times-circle')).toBeTruthy();
    expect(toast.querySelector('.fa-check-circle')).toBeNull();
  });
});
