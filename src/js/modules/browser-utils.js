/**
 * 浏览器环境检测与提示工具
 * 提供手机浏览器检测和环境警告功能，支持会话级去重
 */
import { tl } from './i18n.js';
import NotificationManager from './notification-manager.js';

const DEDUP_KEY = 'esim-mobile-warning-shown';

/**
 * 检测当前是否为手机浏览器
 * @returns {boolean} 是否为手机浏览器
 */
export function isMobileBrowser() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 显示手机环境警告通知
 * 每个会话仅展示一次，避免重复点击造成通知堆叠
 */
export function showMobileWarning() {
  try {
    if (sessionStorage.getItem(DEDUP_KEY)) return;
    sessionStorage.setItem(DEDUP_KEY, '1');
  } catch (_) {}

  NotificationManager.warning(
    tl('当前为手机浏览器环境，部分功能可能受限。如遇错误请切换到 PC 环境操作。'),
    7000
  );
}
