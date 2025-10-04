// 性能优化模块
class PerformanceOptimizer {
  constructor() {
    this.isOnline = navigator.onLine;
    this.observers = new Map(); // Track observers for cleanup
    this.init();
  }

  init() {
    // Delay SW registration to avoid blocking main thread
    setTimeout(() => this.registerServiceWorker(), 2000);
    this.setupNetworkListeners();
    this.optimizeImages();
    this.setupScrollOptimization();
    this.setupIntersectionObserver();
    this.setupTouchOptimization();
  }

  // Cleanup method to prevent memory leaks
  destroy() {
    // Clean up all observers
    this.observers.forEach((observer, key) => {
      observer.disconnect();
    });
    this.observers.clear();
  }

  // 注册Service Worker
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // 允许通过 meta 配置路径（发布在根目录或 dist）
        const swMeta = document.querySelector('meta[name="sw-path"]');
        const swPath = swMeta?.getAttribute('content') || '/sw.js';
               const registration = await navigator.serviceWorker.register(swPath);
               // 注册成功
        
        // 检查更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateNotification();
            }
          });
        });
            } catch (error) {
              console.error('Service Worker registration failed:', error);
      }
    }
  }

  // 显示更新通知
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification fade-in';
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-download me-2"></i>
        新版本可用，点击刷新页面
        <button class="btn btn-sm btn-primary ms-2" onclick="location.reload()">
          刷新
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 10000);
  }

  // 设置网络监听器
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showNetworkStatus('网络已连接', 'success');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showNetworkStatus('网络已断开，使用离线模式', 'warning');
    });
  }

  // 显示网络状态
  showNetworkStatus(message, type) {
    const toast = document.createElement('div');
    toast.className = `network-status ${type} fade-in`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
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
        // Load images slightly before they enter viewport
        rootMargin: '50px'
      });

      images.forEach(img => imageObserver.observe(img));
      
      // Store observer for cleanup
      this.observers.set('images', imageObserver);
    } else {
      // 降级处理
      images.forEach(img => this.loadImage(img));
    }
  }

  // 加载图片 (with error handling)
  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    // Create a new image to preload
    const tempImg = new Image();
    
    tempImg.onload = () => {
      // Check WebP support
      if (this.supportsWebP()) {
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

  // 检查WebP支持
  supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  // 滚动优化
  setupScrollOptimization() {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.updateScrollEffects();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  // 更新滚动效果
  updateScrollEffects() {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    
    parallaxElements.forEach(element => {
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

  // 触摸优化
  setupTouchOptimization() {
    // 防止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);

    // 优化触摸反馈
    document.addEventListener('touchstart', (e) => {
      const target = e.target.closest('.btn, .card, .form-control');
      if (target) {
        target.classList.add('touch-active');
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const target = e.target.closest('.btn, .card, .form-control');
      if (target) {
        setTimeout(() => {
          target.classList.remove('touch-active');
        }, 150);
      }
    }, { passive: true });
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
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  }

  // 防抖函数
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

  // 节流函数
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

  // 性能监控
  setupPerformanceMonitoring() {
    if ('performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const perfData = performance.getEntriesByType('navigation')[0];
          console.log('页面加载性能:', {
            DNS查询: perfData.domainLookupEnd - perfData.domainLookupStart,
            TCP连接: perfData.connectEnd - perfData.connectStart,
            请求响应: perfData.responseEnd - perfData.requestStart,
            DOM解析: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            页面完全加载: perfData.loadEventEnd - perfData.loadEventStart
          });
        }, 0);
      });
    }
  }
}

// 初始化性能优化
const performanceOptimizer = new PerformanceOptimizer();

// 导出供其他模块使用
window.PerformanceOptimizer = PerformanceOptimizer; 