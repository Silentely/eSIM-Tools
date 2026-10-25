import { formatNumber, animateCount, fetchStats, recordEsimSuccess } from '../../src/js/modules/stats-manager.js';

describe('StatsManager Module', () => {
  beforeEach(() => {
    sessionStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('formatNumber', () => {
    test('formats numbers with thousands separators', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1234567)).toBe('1,234,567');
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
      expect(formatNumber(NaN)).toBe('0');
    });
  });

  describe('animateCount', () => {
    test('never produces negative values even if first frame timestamp is early', () => {
      const el = document.createElement('div');
      const startPNow = 1000;
      jest.spyOn(performance, 'now').mockReturnValue(startPNow);

      let capturedCallback = null;
      jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        capturedCallback = cb;
        return 123;
      });

      const recordedValues = [];
      const origTextSetter = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').set;
      Object.defineProperty(el, 'textContent', {
        set(val) {
          recordedValues.push(val);
          origTextSetter.call(this, val);
        },
        get() {
          return this.nodeValue;
        }
      });

      // 启动动画
      const cancel = animateCount(el, 100, 1000);

      // 模拟 requestAnimationFrame 第一帧时间戳早于 performance.now
      expect(typeof capturedCallback).toBe('function');
      capturedCallback(startPNow - 50);

      expect(recordedValues.length).toBeGreaterThan(0);
      recordedValues.forEach(val => {
        const num = parseInt(val.replace(/,/g, ''), 10);
        expect(num).toBeGreaterThanOrEqual(0);
      });

      cancel();
    });

    test('supports immediate cancellation', () => {
      const el = document.createElement('div');
      const cancel = animateCount(el, 50, 1000);
      expect(typeof cancel).toBe('function');
      cancel();
    });
  });

  describe('fetchStats', () => {
    test('fetches and returns parsed stats from endpoint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          configured: true,
          giffgaff: 50,
          simyo: 30,
          total: 80
        })
      });

      const stats = await fetchStats();
      expect(stats).toEqual({
        giffgaff: 50,
        simyo: 30,
        total: 80,
        configured: true,
        ok: true
      });
      expect(global.fetch).toHaveBeenCalledWith(
        '/.netlify/functions/stats',
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' }
        })
      );
    });

    test('returns default zeros and ok=false if request fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const stats = await fetchStats();
      expect(stats).toEqual({
        giffgaff: 0,
        simyo: 0,
        total: 0,
        configured: false,
        ok: false
      });
    });
  });

  describe('recordEsimSuccess', () => {
    test('rejects invalid tool type', async () => {
      const res = await recordEsimSuccess('invalid_tool');
      expect(res).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('sends POST request and marks session storage only when configured and success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, configured: true, count: 1 })
      });

      const rawLpa = 'LPA:1$smdp.example.com$matching-id-secret';
      const res = await recordEsimSuccess('giffgaff', rawLpa);
      expect(res).toBe(true);

      expect(global.fetch).toHaveBeenCalledWith(
        '/.netlify/functions/stats',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'giffgaff' }),
          keepalive: true
        })
      );

      // 验证 sessionStorage 键名中不包含任何原始敏感 LPA 字符串
      const storedKeys = Object.keys(sessionStorage);
      expect(storedKeys.some(k => k.includes('smdp.example.com'))).toBe(false);
      expect(storedKeys.some(k => k.startsWith('esim_stat_reported_giffgaff_'))).toBe(true);

      // 第二次相同调用应被 sessionStorage 去重拦截，不再发起网络请求
      const duplicateRes = await recordEsimSuccess('giffgaff', rawLpa);
      expect(duplicateRes).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('does not mark session storage if backend is unconfigured', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, configured: false, count: 0 })
      });

      const res = await recordEsimSuccess('giffgaff', 'seed-1');
      expect(res).toBe(false);
      expect(Object.keys(sessionStorage).length).toBe(0);
    });

    test('handles server failure gracefully without throwing', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Server unavailable'));

      const res = await recordEsimSuccess('simyo', 'lpa-data-456');
      expect(res).toBe(false);
    });
  });
});
