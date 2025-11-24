import captchaManager from './modules/captcha-manager.js';

try {
  captchaManager.init();
} catch (error) {
  console.error('[CaptchaClient] 初始化失败', error);
}
