/**
 * notification-service 单元测试
 * 覆盖：初始化立即检查、页内去重、标签页隐藏暂停轮询、回到前台补查
 */

import { NotificationService } from '../../src/js/modules/notification-service.js';

describe('NotificationService', () => {
  let service;

  beforeEach(() => {
    jest.useFakeTimers();
    // 直接构造新实例，避免污染全局单例
    service = new NotificationService();
    global.fetch = jest.fn();
    // 默认文档可见
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  afterEach(() => {
    service.destroy();
    jest.useRealTimers();
  });

  function mockLatestNotification(data = null) {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data })
    });
  }

  it('init 时立即检查并显示最新通知', async () => {
    mockLatestNotification({ id: 'n1', message: '测试通知', type: 'info' });
    await service.init();

    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/notifications?mode=latest');
    expect(service.hasShown('n1')).toBe(true);
  });

  it('同一页面生命周期内不重复显示相同通知', async () => {
    mockLatestNotification({ id: 'n1', message: '测试通知', type: 'info' });
    await service.init();

    await service.checkAndShowNotifications();

    // init 一次 + 手动再查一次
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(service.shownNotifications.size).toBe(1);
  });

  it('标签页隐藏时停止轮询，不发起请求', async () => {
    mockLatestNotification({ id: 'n1', message: '测试通知', type: 'info' });
    await service.init();
    const callCount = global.fetch.mock.calls.length;

    // 切到后台
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // 推进超过两个检查周期，不应有任何新请求
    await jest.advanceTimersByTimeAsync(service.checkInterval * 2 + 1000);
    expect(global.fetch.mock.calls.length).toBe(callCount);
  });

  it('回到前台后恢复轮询，并在超过检查周期时立即补查', async () => {
    mockLatestNotification({ id: 'n1', message: '测试通知', type: 'info' });
    await service.init();

    // 切到后台并推进时间（期间无请求）
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await jest.advanceTimersByTimeAsync(service.checkInterval * 2);

    // 回到前台：应恢复轮询并立即补查
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(global.fetch).toHaveBeenCalled();

    // 恢复的轮询在下一个周期应继续触发
    const before = global.fetch.mock.calls.length;
    await jest.advanceTimersByTimeAsync(service.checkInterval);
    expect(global.fetch.mock.calls.length).toBeGreaterThan(before);
  });

  it('回到前台但未超过检查周期时不补查', async () => {
    mockLatestNotification({ id: 'n1', message: '测试通知', type: 'info' });
    await service.init();
    const callCount = global.fetch.mock.calls.length;

    // 切到后台后立即回前台（未超过检查周期）
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(global.fetch.mock.calls.length).toBe(callCount);
  });
});
