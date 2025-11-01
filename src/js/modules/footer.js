// 统一页脚组件：自动注入到页面底部
import './config.js';
import { t, onLocaleChange } from './i18n.js';

function resolveFooterParams() {
  const currentYear = new Date().getFullYear();
  try {
    const cfg = window.__APP_CONFIG__ || {};
    const brand = cfg.brand || 'eSIM Tools';
    const since = Number(cfg.since) || currentYear;
    const yearRange = since && since < currentYear ? `${since}–${currentYear}` : `${currentYear}`;
    return { brand, yearRange };
  } catch (_) {
    return { brand: 'eSIM Tools', yearRange: `${currentYear}` };
  }
}

function translateOrFallback(key, fallback, params) {
  try {
    const value = params ? t(key, params) : t(key);
    if (typeof value === 'string' && value !== key) {
      return value;
    }
  } catch (_) {}
  return fallback;
}

function bindGithubLink(link) {
  const apply = () => {
    const aria = translateOrFallback('footer.github.ariaLabel', '在 GitHub 上查看源码');
    link.setAttribute('aria-label', aria);
  };
  apply();
  onLocaleChange(apply);
}

function bindContainerAria(container) {
  const apply = () => {
    const aria = translateOrFallback('footer.container.ariaLabel', '版权与声明');
    container.setAttribute('aria-label', aria);
  };
  apply();
  onLocaleChange(apply);
}

function bindCopyright(span, options = {}) {
  const custom = typeof options.text === 'string' ? options.text.trim() : '';
  if (custom) {
    span.textContent = custom;
    return;
  }

  const apply = () => {
    const params = resolveFooterParams();
    const fallback = `© ${params.yearRange} ${params.brand}. 保留所有权利。`;
    span.textContent = translateOrFallback('footer.copyright', fallback, params);
  };

  apply();
  onLocaleChange(apply);
}

export function injectFooter(options = {}) {
  if (document.querySelector('footer[data-component="app-footer"]')) return;

  // 优先落位策略：
  // 1) 主页已有的 .footer（免责声明）内追加一行版权
  // 2) 落到 .main-container / .container / main 的末尾
  // 3) 最后退回到 body（避免因 body 为 flex row 导致横排：因此仅最后兜底）

  const createCopyrightNode = () => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.gap = '12px';
    div.style.marginTop = '8px';

    const span = document.createElement('span');
    bindCopyright(span, options);

    const githubLink = document.createElement('a');
    githubLink.href = 'https://github.com/Silentely/eSIM-Tools';
    githubLink.target = '_blank';
    githubLink.rel = 'noopener noreferrer';
    githubLink.style.display = 'flex';
    githubLink.style.alignItems = 'center';
    githubLink.style.justifyContent = 'center';
    githubLink.style.color = '#6b7280';
    githubLink.style.textDecoration = 'none';
    githubLink.style.transition = 'color 0.2s ease';

    const githubIcon = document.createElement('i');
    githubIcon.className = 'fab fa-github';
    githubIcon.style.fontSize = '18px';

    githubLink.addEventListener('mouseenter', () => {
      githubLink.style.color = '#1f2937';
    });

    githubLink.addEventListener('mouseleave', () => {
      githubLink.style.color = '#6b7280';
    });

    githubLink.appendChild(githubIcon);
    bindGithubLink(githubLink);
    div.appendChild(span);
    div.appendChild(githubLink);

    return div;
  };

  // 情形 1：已有站内 footer（如首页免责声明区）
  const existingFooter = document.querySelector('.main-container .footer, .container .footer');
  if (existingFooter) {
    existingFooter.appendChild(createCopyrightNode());
    return;
  }

  // 情形 2 / 3：新建组件化 footer
  const container = document.createElement('footer');
  container.setAttribute('role', 'contentinfo');
  container.setAttribute('data-component', 'app-footer');
  container.style.cssText = [
    'margin-top:40px',
    'padding:16px 0',
    'border-top:1px solid #e5e7eb',
    'color:#6b7280',
    'text-align:center',
    'font-size:14px'
  ].join(';');
  container.appendChild(createCopyrightNode());
  bindContainerAria(container);

  const pickTarget = () => {
    return (
      document.querySelector('.main-container') ||
      document.querySelector('.container') ||
      document.querySelector('main') ||
      document.body
    );
  };

  const target = pickTarget();
  target.appendChild(container);
}

// DOM 就绪后自动注入（可按需在页面脚本中覆盖）
export function autoInjectFooter() {
  const run = () => injectFooter();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}
