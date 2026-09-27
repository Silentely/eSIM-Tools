// 性能优化模块
class PerformanceOptimizer {
  constructor() {
    this.isOnline = navigator.onLine;
    this.observers = new Map(); // Track observers for cleanup
    this.cleanupFns = []; // Track event listener and timer cleanup callbacks
    this.timers = new Set(); // Track setTimeout/setInterval IDs
    this.rafIds = new Set(); // Track pending requestAnimationFrame ids
    this.activeTouchTarget = null; // Track current active touch target
    this._isPaused = false; // Track visibility paused state
    this._webpSupported = null; // 缓存 WebP 检测结果
    this._parallaxElements = null; // 缓存视差元素查询
    this.init();
  }

  init() {
    this.setupNetworkListeners();
    this.optimizeImages();
    this.setupScrollOptimization();
    this.setupIntersectionObserver();
    this.setupTouchOptimization();
    this.setupVisibilityHandler();
  }

  requestFrame(callback) {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return null;
    }
    const id = window.requestAnimationFrame((time) => {
      this.rafIds.delete(id);
      callback(time);
    });
    this.rafIds.add(id);
    return id;
  }

  cancelFrame(id) {
    if (!id) return;
    this.rafIds.delete(id);
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(id);
    }
  }

  setTimer(fn, delay) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, delay);
    this.timers.add(id);
    return id;
  }

  clearTimer(id) {
    if (!id) return;
    this.timers.delete(id);
    clearTimeout(id);
  }

  // Cleanup method to prevent memory leaks
  destroy() {
    // Cancel all tracked requestAnimationFrame ids
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      this.rafIds.forEach(id => {
        window.cancelAnimationFrame(id);
      });
    }
    this.rafIds.clear();

    // Cancel all tracked timers
    this.timers.forEach(id => {
      clearTimeout(id);
    });
    this.timers.clear();

    // Clean up active touch state
    if (this.activeTouchTarget) {
      this.activeTouchTarget.style.removeProperty('--touch-active');
      this.activeTouchTarget.classList.remove('touch-active');
      this.activeTouchTarget = null;
    }

    // Run registered cleanup functions
    while (this.cleanupFns.length > 0) {
      const cleanup = this.cleanupFns.pop();
      try {
        cleanup();
      } catch (err) {
        console.warn('Error during PerformanceOptimizer cleanup:', err);
      }
    }

    // Clean up all observers
    this.observers.forEach((observer) => {
      observer.disconnect();
    });
    this.observers.clear();
  }

  // （Service Worker 已停用）

  // 设置网络监听器
  setupNetworkListeners() {
    const handleOnline = () => {
      this.isOnline = true;
      this.showNetworkStatus('网络已连接', 'success');
    };

    const handleOffline = () => {
      this.isOnline = false;
      this.showNetworkStatus('网络已断开，使用离线模式', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    this.cleanupFns.push(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  }

  // 显示网络状态
  showNetworkStatus(message, type) {
    const toast = document.createElement('div');
    toast.className = `network-status ${type} fade-in`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // 自动移除
    this.setTimer(() => {
      toast.classList.remove('fade-in');
      toast.classList.add('fade-out');
      this.setTimer(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // 图片优化
  optimizeImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            this.loadImage(img);
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });

      images.forEach(img => imageObserver.observe(img));
      this.observers.set('images', imageObserver);
    } else {
      // 降级处理：直接加载所有图片
      images.forEach(img => this.loadImage(img));
    }
  }

  // 加载图片
  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    // 创建临时图片预加载
    const tempImg = new Image();
    
    tempImg.onload = () => {
      // 优先使用 WebP 格式
      if (this.supportsWebP() && !src.endsWith('.webp')) {
        img.src = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      } else {
        img.src = src;
      }
      img.classList.add('fade-in');
      img.removeAttribute('data-src');
    };

    tempImg.onerror = () => {
      // Fallback to original format if WebP fails
      img.src = src;
      img.classList.add('fade-in');
      img.removeAttribute('data-src');
    };

    // Trigger preload
    tempImg.src = this.supportsWebP() ? src.replace(/\.(jpg|jpeg|png)$/i, '.webp') : src;
  }

  // 检查WebP支持（缓存结果避免重复创建canvas）
  supportsWebP() {
    if (this._webpSupported !== null) return this._webpSupported;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    this._webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    return this._webpSupported;
  }

  // 滚动优化
  setupScrollOptimization() {
    let ticking = false;
    let pendingRafId = null;

    const handleScroll = () => {
      if (this._isPaused) return;
      if (!ticking) {
        pendingRafId = this.requestFrame(() => {
          pendingRafId = null;
          this.updateScrollEffects();
          ticking = false;
        });
        if (pendingRafId !== null) {
          ticking = true;
        } else {
          // 无 requestAnimationFrame 降级
          this.updateScrollEffects();
          ticking = false;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    this.cleanupFns.push(() => {
      window.removeEventListener('scroll', handleScroll);
      if (pendingRafId) {
        this.cancelFrame(pendingRafId);
        pendingRafId = null;
      }
    });
  }

  // 更新滚动效果（缓存DOM查询）
  updateScrollEffects() {
    if (this._isPaused) return;
    const scrolled = window.pageYOffset;
    // 首次调用时缓存视差元素
    if (this._parallaxElements === null) {
      this._parallaxElements = document.querySelectorAll('[data-parallax]');
    }

    this._parallaxElements.forEach(element => {
      const speed = element.dataset.parallax || 0.5;
      const yPos = -(scrolled * speed);
      element.style.transform = `translateY(${yPos}px)`;
    });
  }

  // 设置交叉观察器 (with cleanup)
  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          // Optionally unobserve after animation
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('[data-animate]').forEach(el => {
      observer.observe(el);
    });

    // Store observer for cleanup
    this.observers.set('animations', observer);
  }

  // 触摸体验优化（跟踪 activeTarget，解决移出元素抬起按压态残留）
  setupTouchOptimization() {
    if (typeof document === 'undefined') return;

    // 防止双击缩放
    let lastTouchEnd = 0;
    const handleDoubleTap = (event) => {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    };
    document.addEventListener('touchend', handleDoubleTap, false);

    const handleTouchStart = (e) => {
      const target = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('.btn, .card, .form-control')
        : null;
      if (target) {
        this.activeTouchTarget = target;
        target.style.setProperty('--touch-active', '1');
        target.classList.add('touch-active');
      }
    };

    const handleTouchEnd = (e) => {
      const target = this.activeTouchTarget || (e.target && typeof e.target.closest === 'function'
        ? e.target.closest('.btn, .card, .form-control')
        : null);
      this.activeTouchTarget = null;
      if (target) {
        this.requestFrame(() => {
          target.style.removeProperty('--touch-active');
          target.classList.remove('touch-active');
        });
      }
    };

    const handleTouchCancel = (e) => {
      const target = this.activeTouchTarget || (e.target && typeof e.target.closest === 'function'
        ? e.target.closest('.btn, .card, .form-control')
        : null);
      this.activeTouchTarget = null;
      if (target) {
        target.style.removeProperty('--touch-active');
        target.classList.remove('touch-active');
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    this.cleanupFns.push(() => {
      document.removeEventListener('touchend', handleDoubleTap);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    });
  }

  // 页面可见性处理（暂停/恢复滚动观察器与效果）
  setupVisibilityHandler() {
    const handleVisibility = () => {
      if (document.hidden) {
        this._isPaused = true;
        const scrollObserver = this.observers.get('scroll');
        if (scrollObserver) {
          scrollObserver.disconnect();
        }
      } else {
        this._isPaused = false;
        const scrollObserver = this.observers.get('scroll');
        if (scrollObserver) {
          scrollObserver.observe(document.documentElement);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    this.cleanupFns.push(() => {
      document.removeEventListener('visibilitychange', handleVisibility);
    });
  }

  // 预加载关键资源
  preloadCriticalResources() {
    const criticalResources = [
      '/src/styles/design-system.css',
      '/src/styles/animations.css'
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      link.as = 'style';
      document.head.appendChild(link);
    });
  }

  // 显示加载状态
  showLoading(message = '加载中...') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p class="mt-3">${message}</p>
      </div>
    `;

    document.body.appendChild(overlay);

    // 强制重绘
    overlay.offsetHeight;
    overlay.classList.add('show');

    return overlay;
  }

  // 隐藏加载状态
  hideLoading(overlay) {
    if (overlay) {
      overlay.classList.remove('show');
      this.setTimer(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  }
}

// 导出供测试与外部使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerformanceOptimizer };
}

// 初始化性能优化
if (typeof window !== 'undefined') {
  window.PerformanceOptimizer = PerformanceOptimizer;
  document.addEventListener('DOMContentLoaded', () => {
    window.performanceOptimizer = new PerformanceOptimizer();
  });
}
