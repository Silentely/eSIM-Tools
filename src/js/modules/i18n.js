// src/js/modules/i18n.js
// 国际化核心模块：语言检测、切换、文案替换

import {
  SUPPORTED_LOCALES,
  LOCALE_META,
  DOM_TRANSLATIONS,
  TRANSLATIONS,
  TEXT_REPLACEMENTS,
  LITERAL_TRANSLATIONS
} from './i18n-data.js';

const STORAGE_KEY = 'esim-tools-locale';
let currentLocale = detectInitialLocale();
let activePageKey = null;
const replacementCache = new Map();

function detectInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored)) {
      return stored;
    }
  } catch (_) {}

  const navLang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  if (navLang && navLang.toLowerCase().startsWith('zh')) {
    return 'zh';
  }
  return 'en';
}

function getLocaleMeta(locale) {
  return LOCALE_META[locale] || LOCALE_META.zh;
}

function applyHtmlAttributes(locale) {
  const meta = getLocaleMeta(locale);
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dir = 'ltr';
  document.documentElement.setAttribute('data-locale', locale);
}

function updateLanguageSwitcher() {
  const switcher = document.getElementById('languageSwitcher');
  if (!switcher) return;
  const meta = getLocaleMeta(currentLocale);
  switcher.textContent = `🌐 ${meta.switchText}`;
  switcher.setAttribute('aria-label', meta.switchAria);
  switcher.dataset.currentLocale = currentLocale;
  switcher.dataset.targetLocale = meta.switchTarget;
}

function replaceParams(template, params = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value == null ? `{${key}}` : String(value);
  });
}

function resolveTranslation(locale, key) {
  const localeTable = TRANSLATIONS[locale] || {};
  if (localeTable[key]) return localeTable[key];
  if (locale !== 'zh' && TRANSLATIONS.zh && TRANSLATIONS.zh[key]) {
    return TRANSLATIONS.zh[key];
  }
  return key;
}

function applyDomTranslations(pageKey) {
  if (!pageKey) return;
  const entries = DOM_TRANSLATIONS[pageKey] || [];
  entries.forEach((entry) => {
    const nodes = document.querySelectorAll(entry.selector);
    if (!nodes.length) return;
    const value = resolveTranslation(currentLocale, entry.key);
    nodes.forEach((node) => {
      switch (entry.type) {
        case 'text':
          node.textContent = value;
          break;
        case 'html':
          node.innerHTML = value;
          break;
        case 'attr':
          if (entry.attr) node.setAttribute(entry.attr, value);
          break;
        default:
          break;
      }
    });
  });
}

function buildReplacementMap(pageKey) {
  if (!TEXT_REPLACEMENTS[pageKey]) return null;
  if (!replacementCache.has(pageKey)) {
    const map = new Map();
    TEXT_REPLACEMENTS[pageKey].forEach((entry) => {
      if (entry && entry.zh) {
        map.set(entry.zh, entry);
      }
    });
    replacementCache.set(pageKey, map);
  }
  return replacementCache.get(pageKey);
}

function applyTextReplacements(pageKey) {
  const map = buildReplacementMap(pageKey);
  if (!map || map.size === 0) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();

  while (node) {
    const parent = node.parentElement;
    if (parent) {
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') {
        node = walker.nextNode();
        continue;
      }
      if (parent.closest('.lang-zh') || parent.closest('.lang-en')) {
        node = walker.nextNode();
        continue;
      }
    }

    const raw = node.nodeValue;
    if (!raw || !raw.trim()) {
      node = walker.nextNode();
      continue;
    }

    let key = node.__i18nKey;
    if (!key) {
      const trimmed = raw.trim();
      if (!map.has(trimmed)) {
        node = walker.nextNode();
        continue;
      }
      key = trimmed;
      node.__i18nKey = key;
    }

    const entry = map.get(key);
    if (!entry) {
      node = walker.nextNode();
      continue;
    }

    const replacement = currentLocale === 'zh' ? (entry.zh || key) : entry.en || key;
    if (!replacement) {
      node = walker.nextNode();
      continue;
    }

    const leading = raw.match(/^\s*/)[0];
    const trailing = raw.match(/\s*$/)[0];
    node.nodeValue = `${leading}${replacement}${trailing}`;
    node = walker.nextNode();
  }
}

function setupLanguageSwitcher() {
  const switcher = document.getElementById('languageSwitcher');
  if (!switcher) return;
  if (!switcher.__i18nBound) {
    switcher.__i18nBound = true;
    switcher.addEventListener('click', () => {
      const meta = getLocaleMeta(currentLocale);
      setLocale(meta.switchTarget);
    });
  }
  updateLanguageSwitcher();
}

export function initI18n(pageKey) {
  activePageKey = pageKey || null;
  applyHtmlAttributes(currentLocale);
  setupLanguageSwitcher();

  const apply = () => {
    applyDomTranslations(activePageKey);
    applyTextReplacements(activePageKey);
    updateLanguageSwitcher();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
}

export function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale) || locale === currentLocale) return;
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch (_) {}
  applyHtmlAttributes(locale);
  applyDomTranslations(activePageKey);
  applyTextReplacements(activePageKey);
  updateLanguageSwitcher();
  document.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }));
}

export function getCurrentLocale() {
  return currentLocale;
}

export function t(key, params) {
  const template = resolveTranslation(currentLocale, key);
  return replaceParams(template, params);
}

export function tl(source, params) {
  if (currentLocale === 'zh') {
    return replaceParams(source, params);
  }
  const template = LITERAL_TRANSLATIONS[source] || source;
  return replaceParams(template, params);
}

export function onLocaleChange(handler) {
  document.addEventListener('localechange', handler);
}
