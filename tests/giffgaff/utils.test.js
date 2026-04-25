/**
 * Giffgaff 工具函数模块测试
 */

import Utils from '../../src/js/modules/giffgaff/utils';

describe('Giffgaff Utils', () => {
  describe('Cookie 操作', () => {
    beforeEach(() => {
      // 清除所有 cookies
      document.cookie.split(';').forEach(cookie => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
    });

    it('setCookie 应该设置 cookie', () => {
      Utils.setCookie('test', 'value', 1);
      expect(document.cookie).toContain('test=value');
    });

    it('getCookie 应该获取 cookie 值', () => {
      document.cookie = 'test=value';
      expect(Utils.getCookie('test')).toBe('value');
    });

    it('getCookie 应该返回 null 如果 cookie 不存在', () => {
      expect(Utils.getCookie('nonexistent')).toBeNull();
    });

    it('eraseCookie 应该删除 cookie', () => {
      document.cookie = 'test=value';
      Utils.eraseCookie('test');
      expect(Utils.getCookie('test')).toBeNull();
    });
  });

  describe('isServiceTimeAvailable()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('应该在英国服务窗口内返回 true（04:30-21:30 UK）', () => {
      // 使用 1 月（UK 无夏令时，等同 UTC）并显式加 Z，避免本地时区干扰
      const availableTimes = [
        new Date('2024-01-01T04:30:00Z'), // 开始边界
        new Date('2024-01-01T05:00:00Z'),
        new Date('2024-01-01T12:00:00Z'),
        new Date('2024-01-01T21:30:00Z'), // 结束边界
      ];

      availableTimes.forEach(time => {
        jest.spyOn(global, 'Date').mockImplementation(() => time);
        expect(Utils.isServiceTimeAvailable()).toBe(true);
        jest.restoreAllMocks();
      });
    });

    it('应该在英国服务窗口外返回 false', () => {
      const unavailableTimes = [
        new Date('2024-01-01T04:29:00Z'), // 刚早于开始
        new Date('2024-01-01T21:31:00Z'), // 刚晚于结束
        new Date('2024-01-01T02:00:00Z'),
        new Date('2024-01-01T23:00:00Z'),
      ];

      unavailableTimes.forEach(time => {
        jest.spyOn(global, 'Date').mockImplementation(() => time);
        expect(Utils.isServiceTimeAvailable()).toBe(false);
        jest.restoreAllMocks();
      });
    });

    it('应该正确处理边界情况（包含边界）', () => {
      const boundaryTests = [
        { time: new Date('2024-01-01T04:30:00Z'), expected: true },
        { time: new Date('2024-01-01T21:30:00Z'), expected: true },
        { time: new Date('2024-01-01T21:30:59Z'), expected: true },
        { time: new Date('2024-01-01T21:31:00Z'), expected: false },
      ];

      boundaryTests.forEach(({ time, expected }) => {
        jest.spyOn(global, 'Date').mockImplementation(() => time);
        expect(Utils.isServiceTimeAvailable()).toBe(expected);
        jest.restoreAllMocks();
      });
    });
  });

  describe('copyToClipboard()', () => {
    it('应该使用 clipboard API 复制文本', async () => {
      const text = 'test text';
      await Utils.copyToClipboard(text);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
    });

    it('应该在 clipboard API 失败时使用降级方案', async () => {
      // 模拟 clipboard API 失败
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Failed'));

      // 监听 execCommand
      const execCommandSpy = jest.spyOn(document, 'execCommand').mockReturnValue(true);

      const result = await Utils.copyToClipboard('test');

      expect(result).toBe(true);
      expect(execCommandSpy).toHaveBeenCalledWith('copy');

      execCommandSpy.mockRestore();
    });
  });

  describe('generateQRCodeURL()', () => {
    it('应该生成正确的二维码 URL', () => {
      const data = 'test data';
      const url = Utils.generateQRCodeURL(data);

      expect(url).toContain('https://qrcode.show/');
      expect(url).toContain('size=300');
      expect(url).toContain('data=test%20data');
    });

    it('应该支持自定义尺寸', () => {
      const data = 'test';
      const size = 500;
      const url = Utils.generateQRCodeURL(data, size);

      expect(url).toContain('size=500x500');
    });
  });

  describe('formatTime()', () => {
    it('应该格式化时间为 HH:MM', () => {
      const date = new Date('2024-01-01T09:05:00');
      const formatted = Utils.formatTime(date);

      expect(formatted).toBe('09:05');
    });

    it('应该格式化当前时间', () => {
      const mockDate = new Date('2024-01-01T15:30:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const formatted = Utils.formatTime();

      expect(formatted).toBe('15:30');

      global.Date.mockRestore();
    });
  });

  describe('debounce()', () => {
    jest.useFakeTimers();

    it('应该延迟函数执行', () => {
      const mockFn = jest.fn();
      const debouncedFn = Utils.debounce(mockFn, 100);

      debouncedFn('test');
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('应该取消之前的调用', () => {
      const mockFn = jest.fn();
      const debouncedFn = Utils.debounce(mockFn, 100);

      debouncedFn('first');
      jest.advanceTimersByTime(50);
      debouncedFn('second');
      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('second');
    });
  });

  describe('throttle()', () => {
    jest.useFakeTimers();

    it('应该限制函数执行频率', () => {
      const mockFn = jest.fn();
      const throttledFn = Utils.throttle(mockFn, 100);

      // 首次调用立即执行
      throttledFn('first');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');

      // 节流期间内的调用不会立即执行
      throttledFn('second');
      throttledFn('third');
      expect(mockFn).toHaveBeenCalledTimes(1);

      // 尾部调用机制：计时器到期后执行节流期间最后一次排队的调用
      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('third');

      // 新调用仍在节流状态，需要再等一个周期
      throttledFn('fourth');
      expect(mockFn).toHaveBeenCalledTimes(2);

      // 计时器再次到期，执行尾部调用
      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(mockFn).toHaveBeenCalledWith('fourth');
    });
  });

  describe('showStatus()', () => {
    it('应该显示成功状态', () => {
      const element = document.createElement('div');
      Utils.showStatus(element, 'Success message', 'success');

      expect(element.textContent).toBe('Success message');
      expect(element.className).toBe('text-success');
      expect(element.style.display).toBe('block');
    });

    it('应该显示错误状态', () => {
      const element = document.createElement('div');
      Utils.showStatus(element, 'Error message', 'error');

      expect(element.textContent).toBe('Error message');
      expect(element.className).toBe('text-danger');
    });

    it('应该处理 null 元素', () => {
      expect(() => {
        Utils.showStatus(null, 'Message', 'success');
      }).not.toThrow();
    });
  });
});
