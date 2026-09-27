/**
 * Simyo 运行时环境兜底
 * 避免 iOS WebView 注入脚本访问未定义全局变量导致崩溃
 */
(function initSimyoRuntimeFallbacks() {
  if (typeof window === 'undefined') return;
  const globalObject = window;

  // 兜底 currentInset，避免 "Can't find variable: currentInset"
  const insetValue = Number(globalObject.currentInset);
  globalObject.currentInset = Number.isFinite(insetValue) ? insetValue : 0;

  // 兜底 CONFIG，避免 "Can't find variable: CONFIG"
  if (!globalObject.CONFIG || typeof globalObject.CONFIG !== 'object') {
    globalObject.CONFIG = {};
  }

  // 保持兼容：把 currentInset 同步到常见配置字段
  if (typeof globalObject.CONFIG.currentInset === 'undefined') {
    globalObject.CONFIG.currentInset = globalObject.currentInset;
  }
  if (!globalObject.CONFIG.safeArea || typeof globalObject.CONFIG.safeArea !== 'object') {
    globalObject.CONFIG.safeArea = {};
  }
  if (typeof globalObject.CONFIG.safeArea.top === 'undefined') {
    globalObject.CONFIG.safeArea.top = globalObject.currentInset;
  }
})();
