/**
 * 首页统计展示初始化脚本
 */

import { fetchStats, animateCount } from './modules/stats-manager.js';
import { t, hasTranslation, onLocaleChange } from './modules/i18n.js';

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
 * 渲染单个统计文案。
 * 浏览器可能缓存旧版 i18n-data 而缺少新键，此时保持页面现有文案（数字节点仍在 DOM 中），
 * 避免把 home.stats.* 键名直接展示给用户。
 */
function renderStatsLabel(labelEl, key, numberId, value) {
  if (!labelEl || !hasTranslation(key)) return;
  labelEl.innerHTML = t(key, {
    count: `<strong id="${numberId}" class="stat-number">${value}</strong>`
  });
}

/**
 * 渲染指定数字与文案（保留数字 span 节点，避免 innerHTML 摧毁活跃 DOM 引用）
 */
export function renderStatsTexts() {
  const totalLabelEl = document.getElementById('totalStatsLabel');
  const giffgaffLabelEl = document.getElementById('giffgaffStatsLabel');
  const simyoLabelEl = document.getElementById('simyoStatsLabel');

  const totalNumberEl = document.getElementById('totalCount');
  const giffgaffNumberEl = document.getElementById('giffgaffCount');
  const simyoNumberEl = document.getElementById('simyoCount');

  const totalValue = totalNumberEl?.textContent || (currentStats.total !== null ? String(currentStats.total) : '--');
  const giffgaffValue = giffgaffNumberEl?.textContent || (currentStats.giffgaff !== null ? String(currentStats.giffgaff) : '--');
  const simyoValue = simyoNumberEl?.textContent || (currentStats.simyo !== null ? String(currentStats.simyo) : '--');

  renderStatsLabel(totalLabelEl, 'home.stats.total', 'totalCount', totalValue);
  renderStatsLabel(giffgaffLabelEl, 'home.stats.giffgaff', 'giffgaffCount', giffgaffValue);
  renderStatsLabel(simyoLabelEl, 'home.stats.simyo', 'simyoCount', simyoValue);
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
