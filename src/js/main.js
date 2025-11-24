// 主入口文件
import '../styles/design-system.css';
import '../styles/animations.css';
import '../styles/mobile-responsive.css';

// 初始化性能优化
import './performance.js';
import './modules/footer.js';
import { autoInjectFooter } from './modules/footer.js';
import captchaManager from './modules/captcha-manager.js';
// 入口脚本：避免冗余控制台输出

// 通过构建时注入的环境变量设置访问密钥（仅用于本站 Netlify Functions）
window.ACCESS_KEY = (typeof process !== 'undefined' && process.env && process.env.ACCESS_KEY) ? process.env.ACCESS_KEY : '';

captchaManager.init().catch((error) => {
  console.error('[Main] captcha init failed', error);
});

// 统一注入版权页脚
try { autoInjectFooter(); } catch (_) {}
