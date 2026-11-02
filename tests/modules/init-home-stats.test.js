jest.mock('../../src/js/modules/i18n.js', () => ({
  t: jest.fn((key) => key),
  hasTranslation: jest.fn(() => false),
  onLocaleChange: jest.fn()
}));

jest.mock('../../src/js/modules/stats-manager.js', () => ({
  fetchStats: jest.fn().mockResolvedValue({
    ok: false,
    configured: false,
    total: null,
    giffgaff: null,
    simyo: null
  }),
  animateCount: jest.fn(() => () => {})
}));

describe('home stats rendering', () => {
  let renderStatsTexts;
  let t;
  let hasTranslation;

  beforeAll(() => {
    document.body.innerHTML = `
      <span id="totalStatsLabel">已累计成功交付 <strong id="totalCount" class="stat-number">12</strong> 次 eSIM</span>
      <span id="giffgaffStatsLabel">已成功获取 <strong id="giffgaffCount" class="stat-number">8</strong> 次</span>
      <span id="simyoStatsLabel">已成功获取 <strong id="simyoCount" class="stat-number">4</strong> 次</span>
    `;

    ({ renderStatsTexts } = require('../../src/js/init-home-stats.js'));
    ({ t, hasTranslation } = require('../../src/js/modules/i18n.js'));
  });

  beforeEach(() => {
    hasTranslation.mockReturnValue(false);
    t.mockImplementation((key) => key);
    document.getElementById('totalStatsLabel').innerHTML =
      '已累计成功交付 <strong id="totalCount" class="stat-number">12</strong> 次 eSIM';
    document.getElementById('giffgaffStatsLabel').innerHTML =
      '已成功获取 <strong id="giffgaffCount" class="stat-number">8</strong> 次';
    document.getElementById('simyoStatsLabel').innerHTML =
      '已成功获取 <strong id="simyoCount" class="stat-number">4</strong> 次';
  });

  test('keeps existing text instead of leaking i18n keys when translations are stale', () => {
    renderStatsTexts();

    const labels = [...document.querySelectorAll('[id$="StatsLabel"]')];
    labels.forEach((label) => {
      expect(label.textContent).not.toContain('home.stats.');
    });
    expect(document.getElementById('totalStatsLabel').textContent).toContain('12');
    expect(document.getElementById('giffgaffStatsLabel').textContent).toContain('8');
  });

  test('rewrites labels with translated text and preserves number nodes', () => {
    hasTranslation.mockReturnValue(true);
    t.mockImplementation((key, params) => `${key}|${params.count}`);

    renderStatsTexts();

    expect(document.getElementById('totalStatsLabel').textContent).toBe('home.stats.total|12');
    expect(document.getElementById('totalCount').textContent).toBe('12');
    expect(document.getElementById('giffgaffStatsLabel').textContent).toBe('home.stats.giffgaff|8');
  });
});
