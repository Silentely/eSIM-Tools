/**
 * notification-manager 单元测试
 * 覆盖：通知渲染、消息文本化（XSS 防护）、空消息容错、手动关闭、自动消失、类型图标
 */

import notificationManager from '../../src/js/modules/notification-manager.js';

describe('NotificationManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    // 重新初始化容器（单例只建一次，这里清空 body 后重建）
    notificationManager.container = null;
    notificationManager.notifications.clear();
    notificationManager.init();
  });

  afterEach(() => {
    jest.useRealTimers();
    notificationManager.clearAll();
    document.body.innerHTML = '';
  });

  it('显示成功通知并渲染消息文本', () => {
    notificationManager.success('操作成功');

    const notification = document.querySelector('.notification');
    expect(notification).toBeTruthy();
    expect(notification.classList.contains('notification-success')).toBe(true);
    expect(notification.textContent).toContain('操作成功');
  });

  it('消息作为纯文本渲染，不解析 HTML', () => {
    notificationManager.show({
      message: '<img src=x onerror=alert(1)>',
      type: 'info'
    });

    const notification = document.querySelector('.notification');
    expect(notification.querySelector('img')).toBeNull();
    expect(notification.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('null/undefined 消息不应抛错', () => {
    expect(() => notificationManager.show({ message: null, type: 'info' })).not.toThrow();
    expect(() => notificationManager.show({ message: undefined, type: 'info' })).not.toThrow();
  });

  it('手动关闭按钮可隐藏通知', () => {
    const id = notificationManager.show({ message: '可关闭', type: 'info', closable: true });

    const closeBtn = document.querySelector('.notification-close');
    expect(closeBtn).toBeTruthy();
    closeBtn.click();

    // hide 后 300ms 移除元素
    jest.advanceTimersByTime(400);
    expect(document.querySelector('.notification')).toBeNull();
    expect(notificationManager.notifications.has(id)).toBe(false);
  });

  it('closable=false 时不渲染关闭按钮', () => {
    notificationManager.show({ message: '不可关闭', type: 'info', closable: false });
    expect(document.querySelector('.notification-close')).toBeNull();
  });

  it('达到持续时间后自动消失', () => {
    notificationManager.success('自动消失', 1000);
    expect(document.querySelector('.notification')).toBeTruthy();

    jest.advanceTimersByTime(1400);
    expect(document.querySelector('.notification')).toBeNull();
  });

  it('各类型映射正确的图标类', () => {
    const cases = [
      ['success', 'fa-check-circle'],
      ['warning', 'fa-exclamation-triangle'],
      ['error', 'fa-times-circle'],
      ['info', 'fa-info-circle']
    ];

    cases.forEach(([type, iconClass]) => {
      notificationManager.show({ message: type, type });
      const icon = document.querySelectorAll('.notification-icon')[document.querySelectorAll('.notification').length - 1];
      expect(icon.classList.contains(iconClass)).toBe(true);
      notificationManager.clearAll();
    });
  });
});
