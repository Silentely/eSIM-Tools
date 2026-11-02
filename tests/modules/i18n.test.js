import { TRANSLATIONS } from '../../src/js/modules/i18n-data.js';
import { t, hasTranslation, setLocale } from '../../src/js/modules/i18n.js';

describe('i18n translation lookup', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="languageSwitcher" type="button"></button>';
    setLocale('en');
  });

  test('resolves known keys and interpolates params in English', () => {
    expect(hasTranslation('home.stats.total')).toBe(true);
    expect(t('home.stats.total', { count: '<strong>7</strong>' }))
      .toBe('<strong>7</strong> eSIMs successfully generated');
  });

  test('resolves known keys in Chinese', () => {
    setLocale('zh');

    expect(hasTranslation('home.stats.giffgaff')).toBe(true);
    expect(t('home.stats.giffgaff', { count: '<strong>7</strong>' }))
      .toBe('已成功获取 <strong>7</strong> 次');
  });

  test('reports keys missing from both locale tables', () => {
    expect(hasTranslation('home.stats.unknownKey')).toBe(false);
    expect(t('home.stats.unknownKey')).toBe('home.stats.unknownKey');
  });

  test('falls back to Chinese when the active locale lacks a key', () => {
    const saved = TRANSLATIONS.en['home.stats.total'];
    delete TRANSLATIONS.en['home.stats.total'];

    try {
      expect(hasTranslation('home.stats.total')).toBe(true);
      expect(t('home.stats.total', { count: '7' })).toBe('已累计成功交付 7 次 eSIM');
    } finally {
      TRANSLATIONS.en['home.stats.total'] = saved;
    }
  });
});
