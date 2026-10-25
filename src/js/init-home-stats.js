/**
 * 首页统计展示初始化脚本
 */

import { fetchStats, animateCount } from './modules/stats-manager.js';
import { t, onLocaleChange } from './modules/i18n.js';

/**
 * 渲染指定数字与文案
 */
function renderStatsTexts() {
  const totalNumberEl = document.getElementById('totalCount');
  const giffgaffNumberEl = document.getElementById('giffgaffCount');
  const simyoNumberEl = document.getElementById('simyoCount');

  const totalLabelEl = document.getElementById('totalStatsLabel');
  const giffgaffLabelEl = document.getElementById('giffgaffStatsLabel');
  const simyoLabelEl = document.getElementById('simyoStatsLabel');

  if (totalLabelEl) {
    totalLabelEl.innerHTML = t('home.stats.total', {
      count: `<strong id="totalCount" class="stat-number">${totalNumberEl ? totalNumberEl.textContent : '0'}</strong>`
    });
  }

  if (giffgaffLabelEl) {
    giffgaffLabelEl.innerHTML = t('home.stats.giffgaff', {
      count: `<strong id="giffgaffCount" class="stat-number">${giffgaffNumberEl ? giffgaffNumberEl.textContent : '0'}</strong>`
    });
  }

  if (simyoLabelEl) {
    simyoLabelEl.innerHTML = t('home.stats.simyo', {
      count: `<strong id="simyoCount" class="stat-number">${simyoNumberEl ? simyoNumberEl.textContent : '0'}</strong>`
    });
  }
}

export async function initHomeStats() {
  // 监听语言切换，及时更新文案
  onLocaleChange(() => {
    renderStatsTexts();
  });

  const stats = await fetchStats();

  renderStatsTexts();

  // 执行数字平滑滚动动画
  const totalNumberEl = document.getElementById('totalCount');
  const giffgaffNumberEl = document.getElementById('giffgaffCount');
  const simyoNumberEl = document.getElementById('simyoCount');

  if (totalNumberEl) animateCount(totalNumberEl, stats.total);
  if (giffgaffNumberEl) animateCount(giffgaffNumberEl, stats.giffgaff);
  if (simyoNumberEl) animateCount(simyoNumberEl, stats.simyo);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeStats);
} else {
  initHomeStats();
}
