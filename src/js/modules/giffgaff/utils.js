/**
 * Giffgaff 工具函数模块
 */

class Utils {
  /**
   * Cookie 操作
   */
  setCookie(name, value, days) {
    const expires = days ? `; expires=${new Date(Date.now() + days * 864e5).toUTCString()}` : '';
    document.cookie = `${name}=${value || ''}${expires}; path=/`;
  }

  getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  eraseCookie(name) {
    document.cookie = `${name}=; Max-Age=-99999999; path=/`;
  }

  /**
   * 服务时间检查（英国时间）
   * 英国时间凌晨 4:30 至 晚上 9:30 提供 SIM 交换服务
   * 返回 true 表示“当前处于服务可用时段”（英国时间 04:30-21:30）
   */
  isServiceTimeAvailable() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hour12: false, hour: '2-digit', minute: '2-digit'
    }).formatToParts(now);
    const hour = Number(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = Number(parts.find(p => p.type === 'minute')?.value || '0');

    // 服务可用区间：04:30 - 21:30（含边界）
    const afterStart = (hour > 4) || (hour === 4 && minute >= 30);
    const beforeEnd = (hour < 21) || (hour === 21 && minute <= 30);
    return afterStart && beforeEnd;
  }

  /**
   * 获取本地和英国当前时间字符串
   */
  getLocalAndUkTimeStrings(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const local = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const ukStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
    return { local, uk: ukStr };
  }

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textarea);
      return result;
    }
  }

  /**
   * 生成二维码 URL
   */
  generateQRCodeURL(data, size = 300) {
    const encoded = encodeURIComponent(data);
    const dimension = `${size}x${size}`;
    return `https://qrcode.show/qr?size=${dimension}&data=${encoded}`;
  }

  /**
   * 显示 Toast 通知
   */
  showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideUp 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * 显示加载状态
   */
  showLoading(message = '加载中...') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    
    overlay.innerHTML = `
      <div class="loading-content" style="
        background: white;
        padding: 30px;
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      ">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3">${message}</p>
      </div>
    `;
    
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * 隐藏加载状态
   */
  hideLoading(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  }

  /**
   * 防抖函数
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * 节流函数
   */
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * 格式化时间
   */
  formatTime(date = new Date()) {
    return date.getHours().toString().padStart(2, '0') + ':' +
           date.getMinutes().toString().padStart(2, '0');
  }

  /**
   * 显示状态消息
   */
  showStatus(element, message, type) {
    if (!element) return;
    
    element.textContent = message;
    element.className = type === 'success' ? 'text-success' : 
                       type === 'error' ? 'text-danger' : 
                       'text-muted';
    element.style.display = 'block';
  }

  /**
   * 添加动画样式
   */
  addAnimationStyles() {
    if (document.getElementById('giffgaff-animations')) return;
    
    const style = document.createElement('style');
    style.id = 'giffgaff-animations';
    style.textContent = `
      @keyframes slideUp {
        from {
          transform: translateX(-50%) translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
      
      @keyframes slideDown {
        from {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
        to {
          transform: translateX(-50%) translateY(100%);
          opacity: 0;
        }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      
      .fade-in {
        animation: fadeIn 0.3s ease-out;
      }
      
      .fade-out {
        animation: fadeOut 0.3s ease-out;
      }
    `;
    document.head.appendChild(style);
  }
}

export default new Utils();
