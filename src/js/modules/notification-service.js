/**
 * 通知服务
 * 负责从后端获取通知消息并显示
 */

import Logger from './logger.js';
import NotificationManager from './notification-manager.js';

class NotificationService {
  constructor() {
    this.apiUrl = '/.netlify/functions/notifications-internal';
    this.checkInterval = 5 * 60 * 1000; // 5分钟检查一次
    this.lastCheckTime = 0;
    // 需求变更：通知在“每次页面加载”时都要显示一次。
    // 因此这里仅做“本次页面生命周期内去重”，避免定时轮询重复弹出；
    // 不再使用 localStorage 进行跨刷新持久化去重。
    this.shownNotifications = new Set();
  }

  /**
   * 初始化服务
   */
  async init() {
    await this.checkAndShowNotifications();
    this.startPeriodicCheck();
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
   * 启动定期检查
   */
  startPeriodicCheck() {
    setInterval(() => {
      const elapsed = Date.now() - this.lastCheckTime;
      if (elapsed >= this.checkInterval) {
        this.checkAndShowNotifications();
      }
    }, this.checkInterval);
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

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = notificationService;
} else if (typeof window !== 'undefined') {
  window.NotificationService = notificationService;
}

export default notificationService;
