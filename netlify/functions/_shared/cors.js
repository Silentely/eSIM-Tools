/**
 * CORS 来源解析与校验模块
 * middleware.js 和 server.js 共用，避免逻辑漂移
 */

const DEFAULT_ALLOWED_ORIGIN = 'https://esim.cosr.eu.org';

/**
 * 解析 ALLOWED_ORIGIN 环境变量为结构化对象
 * @param {string} allowedOrigin - 逗号分隔的来源列表，支持 * 通配符
 * @returns {{ list: string[], allowAll: boolean }}
 */
function parseOrigins(allowedOrigin) {
  const raw = allowedOrigin || DEFAULT_ALLOWED_ORIGIN;
  const list = raw.split(',').map(o => o.trim()).filter(Boolean);
  return {
    list,
    allowAll: list.includes('*')
  };
}

/**
 * 校验请求来源是否在允许列表中
 * @param {string|null} origin - 请求 Origin 头
 * @param {{ list: string[], allowAll: boolean }} origins - 解析后的来源配置
 * @returns {boolean}
 */
function isAllowedOrigin(origin, origins) {
  if (!origin) return true;
  if (origins.allowAll) return true;
  return origins.list.includes(origin);
}

/**
 * 根据请求来源解析应返回的 Access-Control-Allow-Origin 值
 * @param {string|null} origin - 请求 Origin 头
 * @param {{ list: string[], allowAll: boolean }} origins - 解析后的来源配置
 * @returns {string} CORS 允许的来源值
 */
function resolveCorsOrigin(origin, origins) {
  if (origins.allowAll) return '*';
  if (origin && origins.list.includes(origin)) return origin;
  return origins.list[0] || DEFAULT_ALLOWED_ORIGIN;
}

module.exports = {
  DEFAULT_ALLOWED_ORIGIN,
  parseOrigins,
  isAllowedOrigin,
  resolveCorsOrigin
};
