/**
 * 通用工具函数模块单元测试
 * 覆盖 debounce、throttle、retry、formatBytes、deepClone 等核心功能
 */

import {
  debounce,
  throttle,
  retry,
  formatBytes,
  deepClone,
  isBrowser,
  safeJsonParse,
  memoize
} from '../../src/js/modules/utils';

describe('通用工具函数', () => {
  describe('debounce()', () => {
    jest.useFakeTimers();

    it('应该延迟执行函数', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);
      debounced();
      expect(fn).not.toHaveBeenCalled();
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该取消之前的调用', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);
      debounced('a');
      jest.advanceTimersByTime(50);
      debounced('b');
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('b');
    });

    it('应该支持 leading edge 模式', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100, true);
      debounced();
      expect(fn).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle()', () => {
    jest.useFakeTimers();

    it('应该限制执行频率', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
      throttled();
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry()', () => {
    // retry 使用真实 setTimeout，需要恢复 real timers
    beforeEach(() => {
      jest.useRealTimers();
    });

    it('应该在成功时直接返回结果', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      const result = await retry(fn, 3, 10);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该在失败后重试', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockResolvedValue('ok');
      const result = await retry(fn, 3, 10);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('应该在耗尽重试次数后抛出错误', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('always fail'));
      await expect(retry(fn, 2, 10)).rejects.toThrow('always fail');
      expect(fn).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe('formatBytes()', () => {
    it('应该格式化 0 字节', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('应该格式化字节', () => {
      expect(formatBytes(500)).toBe('500 Bytes');
    });

    it('应该格式化 KB', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    it('应该格式化 MB', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('应该格式化 GB', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('应该支持自定义小数位', () => {
      const result = formatBytes(1536, 1);
      expect(result).toBe('1.5 KB');
    });
  });

  describe('deepClone()', () => {
    it('应该深拷贝对象', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });

    it('应该深拷贝数组', () => {
      const original = [1, [2, 3]];
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it('应该拷贝 Date 对象', () => {
      const date = new Date('2024-01-01');
      const cloned = deepClone(date);
      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });

    it('应该处理 null 和基本类型', () => {
      expect(deepClone(null)).toBeNull();
      expect(deepClone(42)).toBe(42);
      expect(deepClone('str')).toBe('str');
    });
  });

  describe('isBrowser()', () => {
    it('应该在 jsdom 环境中返回 true', () => {
      expect(isBrowser()).toBe(true);
    });
  });

  describe('safeJsonParse()', () => {
    it('应该解析有效 JSON', () => {
      expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });

    it('应该在解析失败时返回 fallback', () => {
      expect(safeJsonParse('invalid', 'default')).toBe('default');
    });

    it('应该在解析失败时返回 null', () => {
      expect(safeJsonParse('invalid')).toBeNull();
    });
  });

  describe('memoize()', () => {
    it('应该缓存函数结果', () => {
      const fn = jest.fn(x => x * 2);
      const memoized = memoize(fn);
      expect(memoized(5)).toBe(10);
      expect(memoized(5)).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该对不同参数分别缓存', () => {
      const fn = jest.fn(x => x * 2);
      const memoized = memoize(fn);
      expect(memoized(5)).toBe(10);
      expect(memoized(3)).toBe(6);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('应该支持自定义 resolver', () => {
      const fn = jest.fn((a, b) => a + b);
      const memoized = memoize(fn, (a, b) => `${a}-${b}`);
      expect(memoized(1, 2)).toBe(3);
      expect(memoized(1, 2)).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
