/**
 * eSIM Tools 统计管理器
 * 负责从后端拉取成功获取统计数据以及上报成功事件
 */

const STATS_ENDPOINT = '/.netlify/functions/stats';

/**
 * 数字格式化（添加千分位逗号）
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return num.toLocaleString();
}

/**
 * 平滑数字递增动画
 * @param {HTMLElement} element - 目标 DOM 元素
 * @param {number} target - 目标数值
 * @param {number} [duration=1200] - 动画持续时间（毫秒）
 */
export function animateCount(element, target, duration = 1200) {
  if (!element) return;
  if (target <= 0) {
    element.textContent = '0';
    return;
  }

  // 如果浏览器设置了减少动画偏好，直接显示最终值
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.textContent = formatNumber(target);
    return;
  }

  const startTime = performance.now();
  const startVal = 0;

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutExpo 缓动曲线
    const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const currentVal = Math.floor(startVal + (target - startVal) * easeProgress);

    element.textContent = formatNumber(currentVal);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = formatNumber(target);
    }
  }

  requestAnimationFrame(step);
}

/**
 * 获取统计数据
 * @returns {Promise<{ giffgaff: number, simyo: number, total: number, configured: boolean }>}
 */
export async function fetchStats() {
  try {
    const response = await fetch(STATS_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return { giffgaff: 0, simyo: 0, total: 0, configured: false };
    }

    const data = await response.json();
    return {
      giffgaff: Number(data.giffgaff) || 0,
      simyo: Number(data.simyo) || 0,
      total: Number(data.total) || 0,
      configured: Boolean(data.configured)
    };
  } catch (error) {
    console.warn('[StatsManager] Failed to fetch stats:', error);
    return { giffgaff: 0, simyo: 0, total: 0, configured: false };
  }
}

/**
 * 生成非敏感短标识
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
  if (!str) return 'default';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * 上报成功获取 eSIM
 * 内置会话去重与非敏感键存储，避免重复刷新多次计数与敏感信息存入
 * @param {'giffgaff'|'simyo'} type - 工具类型
 * @param {string} [seed] - 可选的特征种子（如 LPA 字符串，会自动转换为哈希不暴露原始内容）
 * @returns {Promise<boolean>} 是否上报成功
 */
export async function recordEsimSuccess(type, seed = '') {
  if (type !== 'giffgaff' && type !== 'simyo') {
    return false;
  }

  // 去重键（Session 级别，不存储任何原始 LPA 或敏感字符串）
  const tokenHash = hashString(seed);
  const sessionKey = `esim_stat_reported_${type}_${tokenHash}`;

  try {
    if (sessionStorage.getItem(sessionKey)) {
      return false; // 当前会话已上报过，跳过
    }
  } catch {
    // 忽略 sessionStorage 受限环境
  }

  try {
    const response = await fetch(STATS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type })
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      // 只有在服务端真实配置并递增成功时，才落盘标记已上报
      if (data && data.success && data.configured) {
        try {
          sessionStorage.setItem(sessionKey, '1');
        } catch {
          // ignore
        }
        return true;
      }
    }
  } catch (error) {
    console.warn('[StatsManager] Failed to record success:', error);
  }

  return false;
}
