const CONFIG_ENDPOINT = '/.netlify/functions/public-config';
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const RECAPTCHA_SRC = 'https://www.google.com/recaptcha/api.js?render=explicit';

class CaptchaManager {
  constructor() {
    this.initPromise = null;
    this.config = null;
    this.provider = 'off';
    this.turnstileWidgetId = null;
    this.turnstileExecuting = false;
    this.turnstileInterval = null;
    this.recaptchaWidgetId = null;
    this.recaptchaReadyResolver = null;
    this.recaptchaReadyPromise = null;
  }

  async init() {
    if (!this.initPromise) {
      this.initPromise = this.bootstrap().catch(err => {
        console.error('[CaptchaManager] 初始化失败', err);
        this.provider = 'off';
        window.__captchaProvider = 'off';
        window.__turnstileDisabled = true;
      });
    }
    return this.initPromise;
  }

  async bootstrap() {
    this.config = await this.fetchConfig();
    this.provider = this.config.provider || 'off';
    window.__captchaProvider = this.provider;
    window.__turnstileDisabled = this.provider === 'off';

    if (this.provider === 'turnstile' && this.config.turnstileSiteKey) {
      window.TURNSTILE_SITE_KEY = this.config.turnstileSiteKey;
      await this.initTurnstile();
    } else if (this.provider === 'recaptcha' && this.config.recaptchaSiteKey) {
      await this.initRecaptcha();
    } else {
      window.__esimTurnstileRefresh = () => false;
      this.storeToken(undefined);
    }
  }

  async fetchConfig() {
    try {
      const resp = await fetch(CONFIG_ENDPOINT, { cache: 'no-store' });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (error) {
      console.warn('[CaptchaManager] 获取配置失败', error);
    }
    return { provider: 'off' };
  }

  storeToken(token) {
    if (token) {
      window.__cfTurnstileToken = token;
      window.__captchaToken = token;
    } else {
      delete window.__cfTurnstileToken;
      delete window.__captchaToken;
    }
  }

  async initTurnstile() {
    try {
      await this.loadScript(TURNSTILE_SRC, 'turnstile-loader');

      return new Promise((resolve) => {
        const boot = () => {
          if (!window.turnstile) {
            setTimeout(boot, 200);
            return;
          }
          try {
            const container = document.createElement('div');
            container.style.display = 'none';
            container.setAttribute('aria-hidden', 'true');
            document.body.appendChild(container);

            this.turnstileWidgetId = window.turnstile.render(container, {
              sitekey: this.config.turnstileSiteKey,
              size: 'invisible',
              callback: (token) => {
                this.storeToken(token);
                this.turnstileExecuting = false;
              },
              'error-callback': (err) => {
                window.__lastTurnstileError = err;
                this.turnstileExecuting = false;
                this.refreshTurnstile();
              },
              'timeout-callback': () => {
                this.turnstileExecuting = false;
                this.refreshTurnstile();
              },
              'expired-callback': () => {
                this.turnstileExecuting = false;
                this.refreshTurnstile();
              }
            });
            window.__turnstileWidgetId = this.turnstileWidgetId;
            window.__esimTurnstileRefresh = () => {
              this.refreshTurnstile();
              return true;
            };
            this.refreshTurnstile();
            this.turnstileInterval = setInterval(() => {
              if (document.visibilityState !== 'hidden') {
                this.refreshTurnstile();
              }
            }, 110000);
            resolve();
          } catch (err) {
            console.error('[CaptchaManager] Turnstile 初始化失败:', err);
            window.__lastTurnstileError = err;
            resolve(); // 即使失败也 resolve，不阻塞应用启动
          }
        };
        boot();
      });
    } catch (err) {
      console.error('[CaptchaManager] Turnstile 加载失败:', err);
      window.__lastTurnstileError = err;
      window.__turnstileDisabled = true;
    }
  }

  refreshTurnstile() {
    if (!window.turnstile || this.turnstileWidgetId == null || this.turnstileExecuting) {
      return;
    }
    this.turnstileExecuting = true;
    try {
      window.turnstile.reset(this.turnstileWidgetId);
    } catch (_) {}
    try {
      window.turnstile.execute(this.turnstileWidgetId);
    } catch (err) {
      window.__lastTurnstileError = err;
      this.turnstileExecuting = false;
    }
  }

  async initRecaptcha() {
    window.__turnstileWidgetId = 'recaptcha';
    this.recaptchaReadyPromise = new Promise(resolve => {
      this.recaptchaReadyResolver = resolve;
    });
    window.__esimRecaptchaOnLoad = () => {
      const container = document.createElement('div');
      container.id = 'esim-recaptcha-container';
      container.style.display = 'none';
      document.body.appendChild(container);
      try {
        this.recaptchaWidgetId = grecaptcha.render(container, {
          sitekey: this.config.recaptchaSiteKey,
          size: 'invisible',
          callback: (token) => {
            this.storeToken(token);
          },
          'expired-callback': () => {
            this.storeToken(undefined);
            this.executeRecaptcha();
          },
          'error-callback': (err) => {
            window.__lastTurnstileError = err;
            setTimeout(() => this.executeRecaptcha(), 1000);
          }
        });
        this.executeRecaptcha();
      } catch (err) {
        console.error('[CaptchaManager] 渲染 reCAPTCHA 失败', err);
      } finally {
        if (this.recaptchaReadyResolver) {
          this.recaptchaReadyResolver();
          this.recaptchaReadyResolver = null;
        }
      }
    };
    const src = `${RECAPTCHA_SRC}&onload=__esimRecaptchaOnLoad`;
    await this.loadScript(src, 'recaptcha-loader');
    await this.recaptchaReadyPromise;
    window.__esimTurnstileRefresh = () => {
      this.executeRecaptcha();
      return true;
    };
  }

  executeRecaptcha() {
    if (!window.grecaptcha || this.recaptchaWidgetId == null) {
      return;
    }
    try {
      window.grecaptcha.execute(this.recaptchaWidgetId);
    } catch (err) {
      window.__lastTurnstileError = err;
    }
  }

  loadScript(src, loaderKey) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-captcha-loader="${loaderKey}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.captchaLoader = loaderKey;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }
}

const captchaManager = new CaptchaManager();
export default captchaManager;
