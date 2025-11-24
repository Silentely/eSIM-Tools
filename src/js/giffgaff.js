/**
 * Giffgaff eSIM 工具 - 主入口文件
 * 
 * 这个文件负责初始化 Giffgaff eSIM 管理应用
 * 所有业务逻辑已经模块化到 modules/giffgaff/ 目录下
 */

// 导入样式
import '../styles/design-system.css';
import '../styles/animations.css';
import '../styles/mobile-responsive.css';

// 导入性能优化模块
import './performance.js';
import { autoInjectFooter } from './modules/footer.js';
import captchaManager from './modules/captcha-manager.js';

// 导入 Giffgaff 应用主模块
import giffgaffApp from './modules/giffgaff/app.js';

// 将应用实例暴露到全局（用于调试和某些内联事件处理）
window.giffgaffApp = giffgaffApp;
window.app = giffgaffApp; // 简写别名

// 生产环境不打印冗余日志

// 初始化验证码管理
try {
  captchaManager.init();
} catch (error) {
  console.error('[Giffgaff Entry] captcha init failed', error);
}

// 导出应用实例
export default giffgaffApp;

// 注入统一版权页脚
try { autoInjectFooter(); } catch (_) {}
