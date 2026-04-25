'use strict';

/**
 * 分布式限流模块
 * 优先使用 Netlify Blobs 实现跨实例共享，降级为内存限流
 */

// 内存限流降级方案
const memoryStore = new Map();

function memoryRateLimit(key, windowMs, maxRequests) {
  const now = Date.now();
  const arr = memoryStore.get(key) || [];
  const recent = arr.filter(ts => now - ts < windowMs);
  recent.push(now);
  memoryStore.set(key, recent);
  return recent.length > maxRequests;
}

/**
 * Netlify Blobs 限流（跨实例共享）
 */
async function blobsRateLimit(key, windowMs, maxRequests) {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('rate-limits');

    const data = await store.get(key, { type: 'json' });
    const now = Date.now();

    let timestamps = [];
    if (data && Array.isArray(data.timestamps)) {
      timestamps = data.timestamps.filter(ts => now - ts < windowMs);
    }

    timestamps.push(now);

    const limited = timestamps.length > maxRequests;

    // 更新时间戳记录，设置过期时间为窗口宽度 + 10 秒缓冲
    await store.set(key, JSON.stringify({ timestamps }), {
      expirationTtl: Math.ceil(windowMs / 1000) + 10
    });

    return limited;
  } catch (error) {
    // Blobs 不可用时降级到内存限流
    console.warn('[RateLimiter] Blobs 不可用，降级到内存限流:', error.message);
    return memoryRateLimit(key, windowMs, maxRequests);
  }
}

/**
 * 检查是否被限流
 * @param {string} identifier - 限流标识（通常是 IP）
 * @param {number} windowMs - 时间窗口（毫秒），默认 5 分钟
 * @param {number} maxRequests - 窗口内最大请求数，默认 15 次
 * @returns {Promise<boolean>} 是否被限流
 */
async function isRateLimited(identifier, windowMs = 5 * 60 * 1000, maxRequests = 15) {
  const key = `ratelimit:${identifier}`;
  return blobsRateLimit(key, windowMs, maxRequests);
}

module.exports = { isRateLimited };
