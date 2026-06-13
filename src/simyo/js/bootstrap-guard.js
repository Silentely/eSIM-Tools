/**
 * Bootstrap 错误守卫
 * 捕获 Bootstrap 在特殊浏览器（如 Quark/OpenHarmony）上的非关键异常
 */

window.addEventListener('error', function(e) {
  if (e.message && e.message.includes('bodyTouched')) {
    e.preventDefault();
    console.warn('[Bootstrap Guard] 已忽略非关键异常:', e.message);
  }
});
