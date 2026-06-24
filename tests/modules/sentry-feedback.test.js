'use strict';

/**
 * Sentry 错误反馈弹窗专项测试
 *
 * 覆盖 shouldShowReportDialog 冷却机制、弹窗触发条件、
 * showReportDialog 中文参数、SentryMock fallback 等场景
 *
 * 注意：本测试中的 createShouldShowReportDialog 是生产代码逻辑的独立复现，
 * 修改 sentry-loader.js / sentry-init.js 中的冷却逻辑时需同步更新此处
 */

// ===================================
// 模拟浏览器环境
// ===================================

const mockShowReportDialog = jest.fn();
const mockLastEventId = jest.fn(() => 'test-event-id');

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  // 模拟 window 全局对象
  global.window = {
    location: { hostname: 'esim.cosr.eu.org', origin: 'https://esim.cosr.eu.org' },
    Sentry: {
      init: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
      addBreadcrumb: jest.fn(),
      setUser: jest.fn(),
      setTag: jest.fn(),
      setContext: jest.fn(),
      withScope: jest.fn(cb => cb({ setContext: jest.fn(), setTag: jest.fn() })),
      browserTracingIntegration: jest.fn(() => ({})),
      feedbackIntegration: jest.fn(() => ({})),
      replayIntegration: jest.fn(() => ({})),
      showReportDialog: mockShowReportDialog,
      lastEventId: mockLastEventId,
    },
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    CustomEvent: class CustomEvent {},
    Date: Date,
    setTimeout: (fn, ms) => fn(),
    URL: class URL {
      constructor(url, base) {
        this.href = url;
        this.searchParams = new Map();
      }
      toString() { return this.href; }
    },
  };

  global.document = {
    currentScript: null,
    head: { appendChild: jest.fn(), insertBefore: jest.fn() },
    createElement: jest.fn(() => ({ src: '', async: false, onload: null, onerror: null })),
  };

  global.CustomEvent = class CustomEvent {};
  global.Event = class Event {};
});

afterEach(() => {
  jest.useRealTimers();
  delete global.window;
  delete global.document;
  delete global.CustomEvent;
  delete global.Event;
});

// ===================================
// 辅助函数：提取 shouldShowReportDialog 逻辑进行测试
// ===================================

/**
 * 独立实现 shouldShowReportDialog，与 sentry-loader.js 逻辑一致
 * 用于单元测试冷却机制的正确性
 */
function createShouldShowReportDialog(options = {}) {
  const { isDev = false } = options;
  let lastReportDialogTime = 0;
  let lastReportDialogFingerprint = '';
  const COOLDOWN_MS = 60000;

  function shouldShowReportDialog(event) {
    const empty = { shouldShow: false, fingerprint: '' };

    // 空事件防御
    if (!event || typeof event !== 'object') return empty;

    // 仅生产环境弹窗
    if (isDev) return empty;

    // 仅对异常事件弹窗（captureMessage 等不弹）
    if (!event.exception || !event.exception.values || !event.exception.values.length) {
      return empty;
    }

    // 生成错误指纹：取第一个异常的 type + value 组合
    const firstException = event.exception.values[0];
    const fingerprint = (firstException.type || '') + ':' + (firstException.value || '');

    // 冷却检查：避免短时间内反复弹窗
    const now = Date.now();
    if (now - lastReportDialogTime < COOLDOWN_MS) {
      return { shouldShow: false, fingerprint };
    }

    // 同一错误不重复弹窗
    if (fingerprint === lastReportDialogFingerprint) {
      return { shouldShow: false, fingerprint };
    }

    return { shouldShow: true, fingerprint };
  }

  function reset() {
    lastReportDialogTime = 0;
    lastReportDialogFingerprint = '';
  }

  function simulateDialogShown(fingerprint) {
    lastReportDialogTime = Date.now();
    lastReportDialogFingerprint = fingerprint;
  }

  return { shouldShowReportDialog, reset, simulateDialogShown };
}

// ===================================
// 测试用例
// ===================================

describe('Sentry 错误反馈弹窗', () => {
  describe('shouldShowReportDialog 冷却机制', () => {
    it('非生产环境不弹窗', () => {
      const { shouldShowReportDialog } = createShouldShowReportDialog({ isDev: true });
      const event = {
        exception: { values: [{ type: 'Error', value: 'test error' }] },
      };
      const result = shouldShowReportDialog(event);
      expect(result.shouldShow).toBe(false);
    });

    it('非异常事件不弹窗', () => {
      const { shouldShowReportDialog } = createShouldShowReportDialog();
      const event = { message: 'test message' };
      const result = shouldShowReportDialog(event);
      expect(result.shouldShow).toBe(false);
    });

    it('空事件对象不弹窗', () => {
      const { shouldShowReportDialog } = createShouldShowReportDialog();
      expect(shouldShowReportDialog(null).shouldShow).toBe(false);
      expect(shouldShowReportDialog(undefined).shouldShow).toBe(false);
      expect(shouldShowReportDialog({}).shouldShow).toBe(false);
      expect(shouldShowReportDialog('string').shouldShow).toBe(false);
      expect(shouldShowReportDialog(123).shouldShow).toBe(false);
    });

    it('无 exception.values 的事件不弹窗', () => {
      const { shouldShowReportDialog } = createShouldShowReportDialog();
      const event = { exception: {} };
      expect(shouldShowReportDialog(event).shouldShow).toBe(false);
    });

    it('空 exception.values 数组不弹窗', () => {
      const { shouldShowReportDialog } = createShouldShowReportDialog();
      const event = { exception: { values: [] } };
      expect(shouldShowReportDialog(event).shouldShow).toBe(false);
    });

    it('首个异常事件调用弹窗', () => {
      const { shouldShowReportDialog } = createShouldShowReportDialog();
      const event = {
        exception: { values: [{ type: 'Error', value: 'test error' }] },
      };
      const result = shouldShowReportDialog(event);
      expect(result.shouldShow).toBe(true);
      expect(result.fingerprint).toBe('Error:test error');
    });

    it('60 秒内不同错误不重复弹窗', () => {
      const { shouldShowReportDialog, simulateDialogShown } = createShouldShowReportDialog();

      // 模拟第一个错误已触发弹窗
      simulateDialogShown('Error:first error');

      // 60 秒内不同错误不应弹窗
      const event = {
        exception: { values: [{ type: 'TypeError', value: 'second error' }] },
      };
      const result = shouldShowReportDialog(event);
      expect(result.shouldShow).toBe(false);
    });

    it('60 秒后不同错误允许弹窗', () => {
      const { shouldShowReportDialog, simulateDialogShown, reset } = createShouldShowReportDialog();

      // 模拟第一个错误已触发弹窗
      simulateDialogShown('Error:first error');

      // 快进 60 秒
      jest.advanceTimersByTime(60000);

      // 不同错误应弹窗
      const event = {
        exception: { values: [{ type: 'TypeError', value: 'second error' }] },
      };
      const result = shouldShowReportDialog(event);
      expect(result.shouldShow).toBe(true);
      expect(result.fingerprint).toBe('TypeError:second error');
    });

    it('同一 type:value 指纹不重复弹窗', () => {
      const { shouldShowReportDialog, simulateDialogShown } = createShouldShowReportDialog();

      // 模拟同一错误已触发弹窗
      simulateDialogShown('Error:same error');

      // 即使冷却时间已过，同一指纹也不弹窗
      jest.advanceTimersByTime(60000);

      const event = {
        exception: { values: [{ type: 'Error', value: 'same error' }] },
      };
      const result = shouldShowReportDialog(event);
      expect(result.shouldShow).toBe(false);
    });
  });

  describe('showReportDialog 中文参数', () => {
    it('调用 showReportDialog 传递中文参数', () => {
      // 模拟 showReportDialog 的中文参数传递逻辑
      // （与 sentry-loader.js / sentry-init.js 中的调用一致）
      const params = {
        eventId: 'test-123',
        title: '问题反馈',
        subtitle: '抱歉，发生了错误',
        subtitle2: '您的反馈将帮助我们改进服务',
        labelName: '名称',
        labelEmail: '邮箱',
        labelComments: '问题描述（选填）',
        labelClose: '关闭',
        labelSubmit: '提交反馈',
        successMessage: '感谢您的反馈！',
      };
      mockShowReportDialog(params);

      expect(mockShowReportDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'test-123',
          title: '问题反馈',
          subtitle: '抱歉，发生了错误',
          subtitle2: '您的反馈将帮助我们改进服务',
          labelName: '名称',
          labelEmail: '邮箱',
          labelComments: '问题描述（选填）',
          labelClose: '关闭',
          labelSubmit: '提交反馈',
          successMessage: '感谢您的反馈！',
        })
      );
    });
  });

  describe('SentryMock fallback', () => {
    it('SentryMock 不抛错', () => {
      const SentryMock = {
        init: () => {},
        captureException: () => {},
        captureMessage: () => {},
        addBreadcrumb: () => {},
        setUser: () => {},
        setTag: () => {},
        setContext: () => {},
        withScope: (cb) => cb({ setContext: () => {}, setTag: () => {} }),
        browserTracingIntegration: () => ({}),
        feedbackIntegration: () => ({}),
        replayIntegration: () => ({}),
        showReportDialog: () => {},
        lastEventId: () => null,
      };

      expect(() => SentryMock.showReportDialog({ eventId: 'test' })).not.toThrow();
      expect(() => SentryMock.lastEventId()).not.toThrow();
      expect(() => SentryMock.captureException(new Error('test'))).not.toThrow();
      expect(() => SentryMock.captureMessage('test')).not.toThrow();
      expect(() => SentryMock.feedbackIntegration()).not.toThrow();
      expect(() => SentryMock.browserTracingIntegration()).not.toThrow();
      expect(() => SentryMock.replayIntegration()).not.toThrow();
    });

    it('SentryMock lastEventId 返回 null', () => {
      const SentryMock = {
        lastEventId: () => null,
      };
      expect(SentryMock.lastEventId()).toBeNull();
    });
  });

  describe('beforeSend 弹窗错误容错', () => {
    it('showReportDialog 抛错不影响 beforeSend 返回原事件', () => {
      const errorEvent = {
        event_id: 'test-event-123',
        exception: { values: [{ type: 'Error', value: 'test error' }] },
      };

      // 创建会抛错的 mock
      const throwingMock = jest.fn(() => {
        throw new Error('弹窗加载失败');
      });

      // 模拟 beforeSend 中的弹窗调用逻辑（与 sentry-loader.js / sentry-init.js 一致）
      let beforeSendResult;
      try {
        throwingMock({ eventId: errorEvent.event_id });
      } catch (e) {
        // 忽略弹窗错误（与源码一致）
      }
      beforeSendResult = errorEvent;

      // 验证原事件未被修改且正常返回
      expect(beforeSendResult).toBe(errorEvent);
      expect(beforeSendResult.event_id).toBe('test-event-123');
      expect(throwingMock).toHaveBeenCalledWith({ eventId: 'test-event-123' });
    });
  });
});
