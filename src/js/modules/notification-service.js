/**
 * 通知服务
 * 负责从后端获取通知消息并显示
 *
 * 资源优化：标签页隐藏时暂停轮询（visibilitychange），回到前台后恢复，
 * 避免后台标签页持续调用 Netlify Function 浪费配额。
 */

import Logger from './logger.js';
import NotificationManager from './notification-manager.js';

class NotificationService {
  constructor() {
    this.apiUrl = '/.netlify/functions/notifications';
    this.checkInterval = 5 * 60 * 1000; // 5分钟检查一次
    this.lastCheckTime = 0;
    this.timer = null;
    // 需求变更：通知在"每次页面加载"时都要显示一次。
    // 因此这里仅做"本次页面生命周期内去重"，避免定时轮询重复弹出；
    // 不再使用 localStorage 进行跨刷新持久化去重。
    this.shownNotifications = new Set();
    this.onVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  /**
   * 初始化服务
   */
  async init() {
    await this.checkAndShowNotifications();
    this.startPeriodicCheck();
    this.listenVisibilityChange();
  }

  /**
   * 检查并显示通知
   */
  async checkAndShowNotifications() {
    try {
      const response = await fetch(`${this.apiUrl}?mode=latest`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const { data } = await response.json();
      if (data && !this.hasShown(data.id)) {
        this.showNotification(data);
        this.markAsShown(data.id);
      }

      this.lastCheckTime = Date.now();
      Logger.log('[NotificationService] 检查完成');
    } catch (error) {
      Logger.error('[NotificationService] 检查失败:', error.message);
    }
  }

  /**
   * 显示通知
   */
  showNotification(notification) {
    const { message, type = 'info' } = notification;
    NotificationManager.show({
      message,
      type,
      duration: 8000,
      closable: true
    });
  }

  /**
   * 检查是否已显示过
   */
  hasShown(id) {
    return this.shownNotifications.has(id);
  }

  /**
   * 标记为已显示
   */
  markAsShown(id) {
    this.shownNotifications.add(id);
  }

  /**
   * 启动定期检查（幂等，已启动则跳过）
   */
  startPeriodicCheck() {
    if (this.timer) return;

    this.timer = setInterval(() => {
      // 标签页隐藏时跳过，避免后台消耗 Function 配额
      if (typeof document !== 'undefined' && document.hidden) return;
      this.checkAndShowNotifications();
    }, this.checkInterval);
  }

  /**
   * 停止定期检查
   */
  stopPeriodicCheck() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 监听标签页可见性变化：隐藏暂停、恢复补查
   */
  handleVisibilityChange() {
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      this.stopPeriodicCheck();
      return;
    }

    // 回到前台：恢复轮询；若离开期间已超过一个检查周期，立即补查一次
    this.startPeriodicCheck();
    if (Date.now() - this.lastCheckTime >= this.checkInterval) {
      this.checkAndShowNotifications();
    }
  }

  /**
   * 注册可见性监听
   */
  listenVisibilityChange() {
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  /**
   * 清理资源（停止轮询、移除监听，用于测试与页面卸载）
   */
  destroy() {
    this.stopPeriodicCheck();
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  /**
   * 清除已显示记录（用于测试）
   */
  clearShownNotifications() {
    this.shownNotifications = new Set();
    Logger.log('[NotificationService] 已清除显示记录');
  }
}

// 单例模式
const notificationService = new NotificationService();

export default notificationService;
export { NotificationService };
