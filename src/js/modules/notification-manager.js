/**
 * 通知管理器
 * 轻量级Toast通知系统，支持多种类型和自动消失
 */

import Logger from './logger.js';

class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.init();
  }

  /**
   * 初始化通知容器
   */
  init() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(this.container);
  }

  /**
   * 显示通知
   * @param {Object} options - 通知配置
   * @param {string} options.message - 通知消息
   * @param {string} options.type - 通知类型 (success|warning|error|info)
   * @param {number} options.duration - 持续时间(ms)，0表示不自动关闭
   * @param {boolean} options.closable - 是否可手动关闭
   */
  show({ message, type = 'info', duration = 5000, closable = true }) {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification = this.createNotification(id, message, type, closable);

    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // 触发入场动画
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // 自动关闭
    if (duration > 0) {
      setTimeout(() => this.hide(id), duration);
    }

    Logger.log(`[Notification] ${type}: ${message}`);
    return id;
  }

  /**
   * 创建通知元素
   */
  createNotification(id, message, type, closable) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('data-id', id);

    const icon = this.getIcon(type);
    const closeBtn = closable ? `
      <button class="notification-close" aria-label="关闭通知" data-id="${id}">
        <i class="fas fa-times"></i>
      </button>
    ` : '';

    notification.innerHTML = `
      <div class="notification-content">
        <i class="notification-icon ${icon}"></i>
        <span class="notification-message">${this.escapeHtml(message)}</span>
      </div>
      ${closeBtn}
    `;

    if (closable) {
      notification.querySelector('.notification-close').addEventListener('click', () => {
        this.hide(id);
      });
    }

    return notification;
  }

  /**
   * 隐藏通知
   */
  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;

    notification.classList.remove('show');
    notification.classList.add('hide');

    setTimeout(() => {
      notification.remove();
      this.notifications.delete(id);
    }, 300);
  }

  /**
   * 清除所有通知
   */
  clearAll() {
    this.notifications.forEach((_, id) => this.hide(id));
  }

  /**
   * 获取图标类名
   */
  getIcon(type) {
    const icons = {
      success: 'fas fa-check-circle',
      warning: 'fas fa-exclamation-triangle',
      error: 'fas fa-times-circle',
      info: 'fas fa-info-circle'
    };
    return icons[type] || icons.info;
  }

  /**
   * HTML转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 便捷方法
   */
  success(message, duration = 5000) {
    return this.show({ message, type: 'success', duration });
  }

  warning(message, duration = 5000) {
    return this.show({ message, type: 'warning', duration });
  }

  error(message, duration = 7000) {
    return this.show({ message, type: 'error', duration });
  }

  info(message, duration = 5000) {
    return this.show({ message, type: 'info', duration });
  }
}

// 单例模式
const notificationManager = new NotificationManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = notificationManager;
} else if (typeof window !== 'undefined') {
  window.NotificationManager = notificationManager;
}

export default notificationManager;
