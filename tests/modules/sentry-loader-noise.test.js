/**
 * sentry-loader 全局错误过滤器：浏览器扩展噪音拦截
 *
 * 覆盖 Safari Web Extension 注入的 runtime.sendMessage 噪音（ESIM-TOOLS-1I）：
 * signature "Invalid call to runtime.sendMessage(). Tab not found."
 * 该噪音来自扩展 content script 而非本页代码，必须在 SDK 采集前被 preventDefault 吞掉。
 *
 * 注意：jsdom 下 location.hostname 为 localhost，sentry-loader 走 dev 分支提前返回，
 * 不影响注册阶段挂载的全局监听器，也不会加载 SDK。
 */

describe('sentry-loader 扩展噪音拦截', () => {
  /** jsdom 无 PromiseRejectionEvent 构造器，手工构造可取消事件并挂载 reason */
  function createRejectionEvent(reason) {
    const event = new Event('unhandledrejection', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'reason', { value: reason, writable: false });
    return event;
  }

  beforeEach(() => {
    jest.resetModules();
  });

  beforeEach(async () => {
    await import('../../src/js/sentry-loader.js');
  });

  it('拦截 Safari 扩展 runtime.sendMessage 噪音', () => {
    const event = createRejectionEvent(
      new Error('Invalid call to runtime.sendMessage(). Tab not found.')
    );

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('拦截 messaging API 家族变体（Tab not found 签名）', () => {
    const event = createRejectionEvent(
      new Error('Invalid call to browser.tabs.connect(). Tab not found.')
    );

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('非扩展来源的拒绝不被误拦', () => {
    const event = createRejectionEvent(new Error('HTTP 500 from giffgaff-graphql'));

    window.dispatchEvent(event);

    // 不阻止默认行为，交由 Sentry SDK 正常采集
    expect(event.defaultPrevented).toBe(false);
  });
});
