/**
 * 入场动效初始化
 * 使用 IntersectionObserver 实现滚动触发动画
 */

(function(){
  const initReveal = () => {
    const nodes = document.querySelectorAll('.reveal');
    if (!nodes.length) return;
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('show');
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
      nodes.forEach(el => io.observe(el));
    } else {
      nodes.forEach(el => el.classList.add('show'));
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal, { once: true });
  } else {
    initReveal();
  }
})();
