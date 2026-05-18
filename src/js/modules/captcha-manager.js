const CONFIG_ENDPOINT = '/.netlify/functions/public-config';
const RECAPTCHA_SRC = 'https://www.google.com/recaptcha/api.js?render=explicit';

class CaptchaManager {
  constructor() {
    this.initPromise = null;
    this.config = null;
    this.provider = 'off';
    this.recaptchaWidgetId = null;
    this.recaptchaReadyResolver = null;
    this.recaptchaReadyPromise = null;
    this.recaptchaErrorCount = 0;
    this.recaptchaMaxRetries = 3;
  }

  async init() {
    if (!this.initPromise) {
      this.initPromise = this.bootstrap().catch(err => {
        console.error('[CaptchaManager] 初始化失败', err);
        this.provider = 'off';
        window.__captchaProvider = 'off';
      });
    }
    return this.initPromise;
  }

  async bootstrap() {
    this.config = await this.fetchConfig();
    this.provider = this.config.provider || 'off';
    window.__captchaProvider = this.provider;

    if (this.provider === 'recaptcha' && this.config.recaptchaSiteKey) {
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
      window.__captchaToken = token;
    } else {
      delete window.__captchaToken;
    }
  }

  async initRecaptcha() {
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
            this.recaptchaErrorCount = 0;
          },
          'expired-callback': () => {
            this.storeToken(undefined);
            this.executeRecaptcha();
          },
          'error-callback': () => {
            this.recaptchaErrorCount++;
            if (this.recaptchaErrorCount <= this.recaptchaMaxRetries) {
              setTimeout(() => this.executeRecaptcha(), 1000);
            } else {
              console.warn('[CaptchaManager] reCAPTCHA 连续失败次数超限，停止重试');
            }
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
      console.error('[CaptchaManager] reCAPTCHA 执行失败:', err);
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
