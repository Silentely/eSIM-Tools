/**
 * performance-monitor 单元测试
 * 覆盖：指标批量缓冲写入、缓冲上限立即落盘、destroy 时落盘剩余缓冲
 *
 * 说明：按项目惯例（secure-storage.test.js）通过注入 storage 引用测试，
 * 避免依赖全局 sessionStorage 的可写性。
 */

import { PerformanceMonitor } from '../../src/js/modules/performance-monitor.js';

describe('PerformanceMonitor', () => {
  let store;

  beforeEach(() => {
    jest.useFakeTimers();
    store = new Map();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** 构造实例并注入内存存储 */
  function createMonitor() {
    const monitor = new PerformanceMonitor();
    monitor.storage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear()
    };
    return monitor;
  }

  it('指标先进入内存缓冲，达到落盘间隔后批量写入 sessionStorage', () => {
    const monitor = createMonitor();
    monitor.recordMetric('LCP', { value: 1200, rating: 'good' });

    // 未到落盘时间：存储不应有数据
    expect(store.has('performance-metrics')).toBe(false);

    // 推进超过落盘间隔后应写入
    jest.advanceTimersByTime(1100);
    const stored = JSON.parse(store.get('performance-metrics'));
    expect(stored.LCP).toBeTruthy();
    expect(stored.LCP.value).toBe(1200);
    monitor.destroy();
  });

  it('达到缓冲上限时立即落盘', () => {
    const monitor = createMonitor();
    for (let i = 0; i < monitor.maxPendingEntries; i++) {
      monitor.recordMetric(`metric${i}`, { value: i });
    }

    const stored = JSON.parse(store.get('performance-metrics'));
    expect(Object.keys(stored).length).toBe(monitor.maxPendingEntries);
    monitor.destroy();
  });

  it('destroy 时落盘剩余缓冲', () => {
    const monitor = createMonitor();
    monitor.recordMetric('CLS', { value: 0.05, rating: 'good' });
    monitor.destroy();

    const stored = JSON.parse(store.get('performance-metrics'));
    expect(stored.CLS).toBeTruthy();
    expect(stored.CLS.value).toBe(0.05);
  });

  it('无存储引用时不抛错（环境兜底）', () => {
    const monitor = createMonitor();
    monitor.storage = null;
    expect(() => monitor.recordMetric('LCP', { value: 1 })).not.toThrow();
    expect(() => monitor.flushMetrics()).not.toThrow();
    monitor.destroy();
  });
});
