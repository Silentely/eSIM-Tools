import Logger from './logger.js';

/**
 * Performance Monitoring Utility
 * Tracks and reports Core Web Vitals and custom metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = [];
    // 分析数据批量写入缓冲：避免每条指标都读写一次 sessionStorage
    this.pendingMetrics = {};
    this.flushTimer = null;
    this.flushInterval = 1000; // 批量落盘间隔(ms)
    this.maxPendingEntries = 20; // 缓冲上限，达到立即落盘
    this.onPageHide = () => this.flushMetrics();
    this.initStorage();
    this.initialize();
  }

  /**
   * 初始化存储引用：浏览器使用 sessionStorage，其余环境用内存存储兜底
   * （避免 Node 等无浏览器环境下的裸引用报错，也便于测试注入）
   */
  initStorage() {
    if (typeof sessionStorage !== 'undefined') {
      this.storage = sessionStorage;
      return;
    }
    const mem = new Map();
    this.storage = {
      getItem: (key) => (mem.has(key) ? mem.get(key) : null),
      setItem: (key, value) => mem.set(key, String(value)),
      removeItem: (key) => mem.delete(key),
      clear: () => mem.clear()
    };
  }

  initialize() {
    if (typeof window === 'undefined') return;

    // 页面卸载/切后台前确保缓冲数据落盘
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('visibilitychange', this.onPageHide);

    // Core Web Vitals
    this.observeLCP(); // Largest Contentful Paint
    this.observeFID(); // First Input Delay
    this.observeCLS(); // Cumulative Layout Shift
    this.observeFCP(); // First Contentful Paint
    this.observeTTFB(); // Time to First Byte

    // Navigation Timing
    if (window.performance && performance.timing) {
      window.addEventListener('load', () => {
        setTimeout(() => this.captureNavigationTiming(), 0);
      });
    }
  }

  /**
   * Observe Largest Contentful Paint
   */
  observeLCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];

        this.recordMetric('LCP', {
          value: lastEntry.renderTime || lastEntry.loadTime,
          rating: this.getRating('LCP', lastEntry.renderTime || lastEntry.loadTime),
          element: lastEntry.element?.tagName
        });
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (error) {
      // 有意使用原生 console.warn（勿改为 Logger）：供用户复制到 issue 排查
      console.warn('LCP observer failed:', error);
    }
  }

  /**
   * Observe First Input Delay
   */
  observeFID() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordMetric('FID', {
            value: entry.processingStart - entry.startTime,
            rating: this.getRating('FID', entry.processingStart - entry.startTime),
            eventType: entry.name
          });
        });
      });

      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (error) {
      // 有意使用原生 console.warn（勿改为 Logger）：供用户复制到 issue 排查
      console.warn('FID observer failed:', error);
    }
  }

  /**
   * Observe Cumulative Layout Shift
   */
  observeCLS() {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries = [];

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            const firstSessionEntry = sessionEntries[0];
            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

            // If the entry occurred less than 1 second after the previous entry
            // and less than 5 seconds after the first entry in the session,
            // include it in the current session
            if (sessionValue &&
                entry.startTime - lastSessionEntry.startTime < 1000 &&
                entry.startTime - firstSessionEntry.startTime < 5000) {
              sessionValue += entry.value;
              sessionEntries.push(entry);
            } else {
              sessionValue = entry.value;
              sessionEntries = [entry];
            }

            if (sessionValue > clsValue) {
              clsValue = sessionValue;
              this.recordMetric('CLS', {
                value: clsValue,
                rating: this.getRating('CLS', clsValue)
              });
            }
          }
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (error) {
      // 有意使用原生 console.warn（勿改为 Logger）：供用户复制到 issue 排查
      console.warn('CLS observer failed:', error);
    }
  }

  /**
   * Observe First Contentful Paint
   */
  observeFCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric('FCP', {
              value: entry.startTime,
              rating: this.getRating('FCP', entry.startTime)
            });
          }
        });
      });

      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (error) {
      // 有意使用原生 console.warn（勿改为 Logger）：供用户复制到 issue 排查
      console.warn('FCP observer failed:', error);
    }
  }

  /**
   * Observe Time to First Byte
   */
  observeTTFB() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.responseStart > 0) {
            const ttfb = entry.responseStart - entry.requestStart;
            this.recordMetric('TTFB', {
              value: ttfb,
              rating: this.getRating('TTFB', ttfb)
            });
          }
        });
      });

      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (error) {
      // 有意使用原生 console.warn（勿改为 Logger）：供用户复制到 issue 排查
      console.warn('TTFB observer failed:', error);
    }
  }

  /**
   * Capture Navigation Timing metrics
   */
  captureNavigationTiming() {
    const timing = performance.timing;
    const navigation = {
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      tcp: timing.connectEnd - timing.connectStart,
      request: timing.responseEnd - timing.requestStart,
      response: timing.responseEnd - timing.responseStart,
      domProcessing: timing.domComplete - timing.domLoading,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      pageLoad: timing.loadEventEnd - timing.navigationStart
    };

    this.recordMetric('Navigation', navigation);
  }

  /**
   * Record a custom metric
   */
  recordMetric(name, data) {
    this.metrics.set(name, {
      ...data,
      timestamp: Date.now()
    });

    // Log in development
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      Logger.log(`[Performance] ${name}:`, data);
    }

    // Send to analytics service
    this.queueAnalytics(name, data);
  }

  /**
   * Get performance rating based on metric thresholds
   */
  getRating(metric, value) {
    const thresholds = {
      LCP: { good: 2500, needsImprovement: 4000 },
      FID: { good: 100, needsImprovement: 300 },
      CLS: { good: 0.1, needsImprovement: 0.25 },
      FCP: { good: 1800, needsImprovement: 3000 },
      TTFB: { good: 800, needsImprovement: 1800 }
    };

    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Mark start of a custom timing
   */
  startMark(name) {
    if (performance.mark) {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * Mark end of a custom timing and measure
   */
  endMark(name) {
    if (performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      try {
        const measure = performance.measure(name, `${name}-start`, `${name}-end`);
        this.recordMetric(name, {
          value: measure.duration,
          type: 'custom'
        });
      } catch (error) {
        // 有意使用原生 console.warn（勿改为 Logger）：供用户复制到 issue 排查
        console.warn(`Failed to measure ${name}:`, error);
      }
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics() {
    const result = {};
    for (const [name, data] of this.metrics.entries()) {
      result[name] = data;
    }
    return result;
  }

  /**
   * 入队分析指标（节流批量写入 sessionStorage）
   */
  queueAnalytics(name, data) {
    this.pendingMetrics[name] = { ...data, timestamp: Date.now() };

    // 达到缓冲上限立即落盘；否则定时批量写入
    if (Object.keys(this.pendingMetrics).length >= this.maxPendingEntries) {
      this.flushMetrics();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushMetrics(), this.flushInterval);
    }
  }

  /**
   * 将缓冲中的指标一次性写入 sessionStorage
   */
  flushMetrics() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const pending = this.pendingMetrics;
    this.pendingMetrics = {};
    if (Object.keys(pending).length === 0) return;

    const storage = this.storage;
    if (!storage) return;

    try {
      const stored = JSON.parse(storage.getItem('performance-metrics') || '{}');
      Object.assign(stored, pending);
      storage.setItem('performance-metrics', JSON.stringify(stored));
    } catch (error) {
      // Ignore storage errors
    }
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const metrics = this.getMetrics();
    const report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics
    };

    console.table(metrics);
    return report;
  }

  /**
   * Clean up observers
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
    // 落盘剩余缓冲并移除生命周期监听
    this.flushMetrics();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
      document.removeEventListener('visibilitychange', this.onPageHide);
    }
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
export { PerformanceMonitor };
