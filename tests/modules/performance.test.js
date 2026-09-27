/**
 * @jest-environment jsdom
 */

const { PerformanceOptimizer } = require('../../src/js/performance.js');

describe('PerformanceOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    document.body.innerHTML = `
      <img data-src="https://example.com/test.png" class="lazy" />
      <div data-parallax="0.5" id="parallax-el">Parallax</div>
      <div data-animate class="fade">Animated</div>
      <button class="btn">Click me</button>
    `;
    optimizer = new PerformanceOptimizer();
  });

  afterEach(() => {
    if (optimizer) {
      optimizer.destroy();
    }
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('initializes and detects network state', () => {
    expect(optimizer).toBeDefined();
    expect(optimizer.isOnline).toBe(true);
  });

  it('shows and auto-dismisses network status toast', () => {
    jest.useFakeTimers();
    optimizer.showNetworkStatus('网络测试', 'info');
    const toast = document.querySelector('.network-status');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('网络测试');

    // Fast-forward past 3000ms fade-out trigger
    jest.advanceTimersByTime(3000);
    expect(toast.classList.contains('fade-out')).toBe(true);

    // Fast-forward past 300ms removal
    jest.advanceTimersByTime(300);
    expect(document.querySelector('.network-status')).toBeNull();
    jest.useRealTimers();
  });

  it('supportsWebP caches result after first check', () => {
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/webp;base64,mock');
    expect(optimizer.supportsWebP()).toBe(true);
    expect(optimizer._webpSupported).toBe(true);
    // Second call should return cached value without calling toDataURL again
    HTMLCanvasElement.prototype.toDataURL.mockClear();
    expect(optimizer.supportsWebP()).toBe(true);
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
  });

  it('updates scroll effects without error', () => {
    window.pageYOffset = 100;
    optimizer.updateScrollEffects();

    const el = document.getElementById('parallax-el');
    expect(el.style.transform).toBe('translateY(-50px)');
  });

  it('handles visibility changes by pausing parallax scroll', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(optimizer._isPaused).toBe(true);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(optimizer._isPaused).toBe(false);
  });

  it('shows and hides loading overlay', () => {
    jest.useFakeTimers();
    const overlay = optimizer.showLoading('加载中...');
    expect(overlay).not.toBeNull();
    expect(overlay.classList.contains('show')).toBe(true);
    expect(overlay.textContent).toContain('加载中...');

    optimizer.hideLoading(overlay);
    expect(overlay.classList.contains('show')).toBe(false);

    jest.advanceTimersByTime(350);
    expect(document.querySelector('.loading-overlay')).toBeNull();
    jest.useRealTimers();
  });

  it('preloads critical CSS resources', () => {
    optimizer.preloadCriticalResources();
    const links = document.querySelectorAll('link[rel="preload"]');
    expect(links.length).toBe(2);
    expect(links[0].href).toContain('/src/styles/design-system.css');
  });

  it('cleans up observers, timers, and listeners on destroy', () => {
    expect(optimizer.cleanupFns.length).toBeGreaterThan(0);
    optimizer.destroy();
    expect(optimizer.observers.size).toBe(0);
    expect(optimizer.cleanupFns.length).toBe(0);
    expect(optimizer.timers.size).toBe(0);
    expect(optimizer.rafIds.size).toBe(0);
  });

  it('tracks touchend RAF and cancels it on destroy', () => {
    let mockRafId = 100;
    const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => ++mockRafId);

    const btn = document.querySelector('.btn');
    const touchEndEvent = new Event('touchend', { bubbles: true });
    Object.defineProperty(touchEndEvent, 'target', { value: btn });

    document.dispatchEvent(touchEndEvent);

    expect(optimizer.rafIds.size).toBe(1);
    const trackedId = Array.from(optimizer.rafIds)[0];

    optimizer.destroy();

    expect(cancelSpy).toHaveBeenCalledWith(trackedId);
    expect(optimizer.rafIds.size).toBe(0);
  });

  it('handles touchstart and touchend gracefully on targets without closest method', () => {
    const rawTarget = {}; // Not an Element
    const touchStartEvent = new Event('touchstart', { bubbles: true });
    Object.defineProperty(touchStartEvent, 'target', { value: rawTarget });

    expect(() => {
      document.dispatchEvent(touchStartEvent);
    }).not.toThrow();

    const touchEndEvent = new Event('touchend', { bubbles: true });
    Object.defineProperty(touchEndEvent, 'target', { value: rawTarget });

    expect(() => {
      document.dispatchEvent(touchEndEvent);
    }).not.toThrow();
  });

  it('tracks scroll pending RAF and cancels it on destroy', () => {
    let mockRafId = 200;
    const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => ++mockRafId);

    window.dispatchEvent(new Event('scroll'));

    expect(optimizer.rafIds.size).toBe(1);
    const trackedId = Array.from(optimizer.rafIds)[0];

    optimizer.destroy();

    expect(cancelSpy).toHaveBeenCalledWith(trackedId);
    expect(optimizer.rafIds.size).toBe(0);
  });

  it('handles touchcancel event by removing touch-active styles immediately', () => {
    const btn = document.querySelector('.btn');
    btn.style.setProperty('--touch-active', '1');
    btn.classList.add('touch-active');

    const touchCancelEvent = new Event('touchcancel', { bubbles: true });
    Object.defineProperty(touchCancelEvent, 'target', { value: btn });

    document.dispatchEvent(touchCancelEvent);

    expect(btn.classList.contains('touch-active')).toBe(false);
    expect(btn.style.getPropertyValue('--touch-active')).toBe('');
  });

  it('releases active touch target when touch ends or cancels outside original element', () => {
    const btn = document.querySelector('.btn');
    const outsideDiv = document.createElement('div');
    document.body.appendChild(outsideDiv);

    // Touch starts on button
    const touchStartEvent = new Event('touchstart', { bubbles: true });
    Object.defineProperty(touchStartEvent, 'target', { value: btn });
    document.dispatchEvent(touchStartEvent);

    expect(optimizer.activeTouchTarget).toBe(btn);
    expect(btn.classList.contains('touch-active')).toBe(true);

    // Finger moves outside button and cancels on outsideDiv
    const touchCancelEvent = new Event('touchcancel', { bubbles: true });
    Object.defineProperty(touchCancelEvent, 'target', { value: outsideDiv });
    document.dispatchEvent(touchCancelEvent);

    expect(optimizer.activeTouchTarget).toBeNull();
    expect(btn.classList.contains('touch-active')).toBe(false);
    expect(btn.style.getPropertyValue('--touch-active')).toBe('');
  });
});
