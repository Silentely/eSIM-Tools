// 主入口文件
import '../styles/design-system.css';
import '../styles/animations.css';
import '../styles/mobile-responsive.css';

// 初始化性能优化
import './performance.js';
import './modules/footer.js';
import { autoInjectFooter } from './modules/footer.js';
// 入口脚本：避免冗余控制台输出

// 通过构建时注入的环境变量设置访问密钥（仅用于本站 Netlify Functions）
window.ACCESS_KEY = (typeof process !== 'undefined' && process.env && process.env.ACCESS_KEY) ? process.env.ACCESS_KEY : '';

// 注入 Turnstile site key（若存在则在页面加载后自动挂载 Turnstile）
// 优先使用构建环境变量；未配置则使用提供的站点密钥
window.TURNSTILE_SITE_KEY = (typeof process !== 'undefined' && process.env && process.env.TURNSTILE_SITE_KEY)
  ? process.env.TURNSTILE_SITE_KEY
  : '0x4AAAAAABqjeVscZAiqB11B';


if (window.TURNSTILE_SITE_KEY) {
  const ensureLoaderScript = () => {
    if (window.turnstile) {
      return true;
    }
    const selector = 'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]';
    const existing = document.querySelector(selector);
    if (existing) {
      if (!existing.dataset.turnstileLoader) {
        existing.dataset.turnstileLoader = 'true';
      }
      return false;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.dataset.turnstileLoader = 'true';
    document.head.appendChild(script);
    return false;
  };

  // 定义回调，保存 token 供 /bff/* 请求使用
  window.onTurnstileDone = (token) => {
    window.__cfTurnstileToken = token;
  };

let widgetId = null;
let hasExecuted = false;
let executing = false;

const exposeRefreshHandle = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.__turnstileWidgetId = widgetId;
  window.__esimTurnstileRefresh = () => {
    if (!window.turnstile || widgetId == null) {
      return false;
    }
    markIdle();
    try { window.turnstile.reset(widgetId); } catch (_) {}
    try {
      runExecute();
      return true;
    } catch (_) {
      return false;
    }
  };
};

const markIdle = () => { executing = false; };

  const handleToken = (token) => {
    window.__cfTurnstileToken = token;
    markIdle();
  };

  const runExecute = () => {
    if (!window.turnstile || widgetId == null || executing) {
      return;
    }
    executing = true;
    if (hasExecuted) {
      try { window.turnstile.reset(widgetId); } catch (_) {}
    }
    hasExecuted = true;
    try {
      window.turnstile.execute(widgetId);
    } catch (_) {
      markIdle();
    }
  };

  const initTurnstile = () => {
    if (!window.turnstile) {
      setTimeout(initTurnstile, 300);
      return;
    }
    const container = document.createElement('div');
    container.style.display = 'none';
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);
    widgetId = window.turnstile.render(container, {
      sitekey: window.TURNSTILE_SITE_KEY,
      size: 'invisible',
      callback: handleToken,
      'error-callback': (err) => {
        window.__lastTurnstileError = err;
        markIdle();
        setTimeout(() => window.__esimTurnstileRefresh?.(), 300);
      },
      'timeout-callback': () => {
        markIdle();
        window.__esimTurnstileRefresh?.();
      },
      'expired-callback': () => {
        markIdle();
        runExecute();
      }
    });
    exposeRefreshHandle();
    runExecute();
    setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      runExecute();
    }, 110000);
  };

  const boot = () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initTurnstile, { once: true });
    } else {
      initTurnstile();
    }
  };

  if (ensureLoaderScript()) {
    boot();
  } else {
    const waitForScript = () => {
      if (window.turnstile) {
        boot();
        return;
      }
      setTimeout(waitForScript, 150);
    };
    waitForScript();
  }
}

// 统一注入版权页脚
try { autoInjectFooter(); } catch (_) {}
