/**
 * 首页统计展示初始化脚本
 */

import { fetchStats, animateCount } from './modules/stats-manager.js';
import { t, onLocaleChange } from './modules/i18n.js';

let currentStats = {
  total: null,
  giffgaff: null,
  simyo: null,
  configured: false
};

// 动画取消函数清理器
const activeAnimators = new Set();

function clearAnimators() {
  activeAnimators.forEach((cancel) => {
    try {
      cancel();
    } catch {
      // ignore
    }
  });
  activeAnimators.clear();
}

/**
 * 渲染指定数字与文案（保留数字 span 节点，避免 innerHTML 摧毁活跃 DOM 引用）
 */
function renderStatsTexts() {
  const totalLabelEl = document.getElementById('totalStatsLabel');
  const giffgaffLabelEl = document.getElementById('giffgaffStatsLabel');
  const simyoLabelEl = document.getElementById('simyoStatsLabel');

  const totalNumberEl = document.getElementById('totalCount');
  const giffgaffNumberEl = document.getElementById('giffgaffCount');
  const simyoNumberEl = document.getElementById('simyoCount');

  const totalValue = totalNumberEl?.textContent || (currentStats.total !== null ? String(currentStats.total) : '--');
  const giffgaffValue = giffgaffNumberEl?.textContent || (currentStats.giffgaff !== null ? String(currentStats.giffgaff) : '--');
  const simyoValue = simyoNumberEl?.textContent || (currentStats.simyo !== null ? String(currentStats.simyo) : '--');

  if (totalLabelEl) {
    totalLabelEl.innerHTML = t('home.stats.total', {
      count: `<strong id="totalCount" class="stat-number">${totalValue}</strong>`
    });
  }

  if (giffgaffLabelEl) {
    giffgaffLabelEl.innerHTML = t('home.stats.giffgaff', {
      count: `<strong id="giffgaffCount" class="stat-number">${giffgaffValue}</strong>`
    });
  }

  if (simyoLabelEl) {
    simyoLabelEl.innerHTML = t('home.stats.simyo', {
      count: `<strong id="simyoCount" class="stat-number">${simyoValue}</strong>`
    });
  }
}

export async function initHomeStats() {
  // 1. 同步进行首屏文案本地化渲染，防止英文用户因网络未返回而看到初始中文
  renderStatsTexts();

  // 2. 监听语言切换：取消进行中的帧动画，直接设置当前最新值，解决语言切换数字冻结问题
  onLocaleChange(() => {
    clearAnimators();
    renderStatsTexts();

    // 重新校准为最新最终数值
    const totalEl = document.getElementById('totalCount');
    const giffgaffEl = document.getElementById('giffgaffCount');
    const simyoEl = document.getElementById('simyoCount');

    if (totalEl && currentStats.total !== null) totalEl.textContent = currentStats.total.toLocaleString();
    if (giffgaffEl && currentStats.giffgaff !== null) giffgaffEl.textContent = currentStats.giffgaff.toLocaleString();
    if (simyoEl && currentStats.simyo !== null) simyoEl.textContent = currentStats.simyo.toLocaleString();
  });

  // 3. 异步拉取后端统计数据
  const stats = await fetchStats();
  currentStats = stats;

  // 如果后端未配置 Upstash 或完全故障，保持默认优雅占位状态，不强行显示 "0 次" 造成无人使用的误解
  if (!stats.ok || !stats.configured) {
    const totalEl = document.getElementById('totalCount');
    const giffgaffEl = document.getElementById('giffgaffCount');
    const simyoEl = document.getElementById('simyoCount');
    if (totalEl) totalEl.textContent = '--';
    if (giffgaffEl) giffgaffEl.textContent = '--';
    if (simyoEl) simyoEl.textContent = '--';
    return;
  }

  // 4. 执行数字平滑递增动画
  clearAnimators();
  const totalNumberEl = document.getElementById('totalCount');
  const giffgaffNumberEl = document.getElementById('giffgaffCount');
  const simyoNumberEl = document.getElementById('simyoCount');

  if (totalNumberEl) {
    const cancel = animateCount(totalNumberEl, stats.total);
    activeAnimators.add(cancel);
  }
  if (giffgaffNumberEl) {
    const cancel = animateCount(giffgaffNumberEl, stats.giffgaff);
    activeAnimators.add(cancel);
  }
  if (simyoNumberEl) {
    const cancel = animateCount(simyoNumberEl, stats.simyo);
    activeAnimators.add(cancel);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeStats);
} else {
  initHomeStats();
}
