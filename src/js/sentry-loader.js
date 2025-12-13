/**
 * Sentry SDK CDN 加载器
 *
 * 在 HTML <head> 中尽早加载此脚本，它会：
 * 1. 异步加载 Sentry SDK from CDN
 * 2. 触发 'sentry-sdk-loaded' 事件通知其他模块
 *
 * 使用方法：
 * <script src="/src/js/sentry-loader.js"></script>
 */

(function() {
  'use strict';

  // 开发环境检测
  var hostname = window.location.hostname;
  var isDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

  // 开发环境不加载 SDK
  if (isDev) {
    console.log('[Sentry Loader] 开发环境，跳过 SDK 加载');
    return;
  }

  // Sentry SDK CDN URL (v8.x)
  var SENTRY_SDK_URL = 'https://browser.sentry-cdn.com/8.40.0/bundle.tracing.min.js';

  // 创建 script 标签
  var script = document.createElement('script');
  script.src = SENTRY_SDK_URL;
  script.crossOrigin = 'anonymous';
  script.async = true;

  script.onload = function() {
    console.log('[Sentry Loader] SDK 加载成功');
    // 触发自定义事件通知其他模块
    window.dispatchEvent(new CustomEvent('sentry-sdk-loaded'));
  };

  script.onerror = function() {
    console.warn('[Sentry Loader] SDK 加载失败，错误监控将不可用');
  };

  // 插入到 head 最前面
  var firstScript = document.getElementsByTagName('script')[0];
  if (firstScript) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }
})();
