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
    this.shownNotifications = this.loadShownNotifications();
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
    return this.shownNotifications.includes(id);
  }

  /**
   * 标记为已显示
   */
  markAsShown(id) {
    if (!this.shownNotifications.includes(id)) {
      this.shownNotifications.push(id);
      this.saveShownNotifications();
    }
  }

  /**
   * 加载已显示记录
   */
  loadShownNotifications() {
    try {
      const stored = localStorage.getItem('esim_shown_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * 保存已显示记录
   */
  saveShownNotifications() {
    try {
      localStorage.setItem('esim_shown_notifications', JSON.stringify(this.shownNotifications));
    } catch (error) {
      Logger.warn('[NotificationService] 保存失败:', error.message);
    }
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
    this.shownNotifications = [];
    localStorage.removeItem('esim_shown_notifications');
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
