/**
 * Giffgaff 全局错误处理器：浏览器扩展噪音识别
 *
 * 覆盖 Safari Web Extension 注入的 runtime.sendMessage 噪音（Sentry Issue 7742657909）：
 * 签名 "Invalid call to runtime.sendMessage(). Tab not found."
 * 该错误由扩展 content script 向已失效标签页投递消息产生，与本页代码无关，
 * 必须被静默拦截，既不上报噪音，也不向用户弹出"操作失败"提示。
 */

describe('GiffgaffApp 扩展噪音识别', () => {
  let app;
  let showToastMock;
  let loggerDebugMock;

  /** jsdom 无 PromiseRejectionEvent 构造器，手工构造可取消事件并挂载 reason */
  function createRejectionEvent(reason) {
    const event = new Event('unhandledrejection', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'reason', { value: reason, writable: false });
    return event;
  }

  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();

    showToastMock = jest.fn();
    loggerDebugMock = jest.fn();

    // 模拟依赖模块，避免 import 阶段触发真实 DOM 初始化与网络请求
    jest.doMock('../../src/giffgaff/js/modules/state-manager.js', () => ({
      stateManager: {
        subscribe: jest.fn(),
        loadSession: jest.fn(() => false),
        getCookie: jest.fn(() => null),
        get: jest.fn(() => null),
      },
    }));

    jest.doMock('../../src/giffgaff/js/modules/ui-controller.js', () => ({
      uiController: {
        elements: {},
        updateStatusPanel: jest.fn(),
        showSection: jest.fn(),
        selectLoginMethod: jest.fn(),
      },
    }));

    jest.doMock('../../src/giffgaff/js/modules/oauth-handler.js', () => ({
      oauthHandler: { handleCallback: jest.fn() },
    }));
    jest.doMock('../../src/giffgaff/js/modules/cookie-handler.js', () => ({
      cookieHandler: { startValidityMonitor: jest.fn() },
    }));
    jest.doMock('../../src/giffgaff/js/modules/mfa-handler.js', () => ({
      mfaHandler: { sendChallenge: jest.fn() },
    }));
    jest.doMock('../../src/giffgaff/js/modules/esim-service.js', () => ({
      esimService: { reserveESim: jest.fn() },
    }));

    jest.doMock('../../src/giffgaff/js/modules/utils.js', () => ({
      isServiceTimeAvailable: jest.fn(() => true),
      showServiceTimeWarning: jest.fn(),
      copyTextFromCode: jest.fn(),
      showToast: (...args) => showToastMock(...args),
      openTutorial: jest.fn(),
      getTimeUntilServiceOpen: jest.fn(() => 0),
      copyLPAString: jest.fn(),
      downloadQRCode: jest.fn(),
    }));

    jest.doMock('../../src/js/modules/i18n.js', () => ({
      t: (key) => key,
      tl: (text) => text,
    }));
    jest.doMock('../../src/js/modules/browser-utils.js', () => ({
      isMobileBrowser: jest.fn(() => false),
      showMobileWarning: jest.fn(),
    }));
    jest.doMock('../../src/js/modules/captcha-manager.js', () => ({
      __esModule: true,
      default: { init: jest.fn(() => Promise.resolve()) },
    }));
    jest.doMock('../../src/js/modules/logger.js', () => ({
      __esModule: true,
      default: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: (...args) => loggerDebugMock(...args),
      },
    }));
    jest.doMock('../../src/js/modules/diagnostics.js', () => ({
      installDiagnosticsGlobal: jest.fn(),
    }));

    // 模块顶层即 new GiffgaffApp() 并调用 init()
    app = (await import('../../src/giffgaff/js/giffgaff-app.js')).default;

    // init() 为异步过程，等待微任务排空后清空其可能产生的提示，避免污染断言
    await Promise.resolve();
    await Promise.resolve();
    showToastMock.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('拦截 Safari 扩展 runtime.sendMessage 噪音且不打扰用户', () => {
    const event = createRejectionEvent(
      new Error('Invalid call to runtime.sendMessage(). Tab not found.')
    );

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(showToastMock).not.toHaveBeenCalled();
    expect(loggerDebugMock).toHaveBeenCalledWith(
      '[Giffgaff] Ignored browser noise rejection:',
      'Invalid call to runtime.sendMessage(). Tab not found.'
    );
  });

  it('拦截 messaging API 家族变体（Tab not found 签名）', () => {
    const event = createRejectionEvent(
      new Error('Invalid call to browser.tabs.connect(). Tab not found.')
    );

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('真实业务错误仍然提示用户，不被扩展噪音规则误伤', () => {
    const event = createRejectionEvent(new Error('HTTP 500 from giffgaff-graphql'));

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(showToastMock).toHaveBeenCalledWith('操作失败，请重试或刷新页面');
  });
});
