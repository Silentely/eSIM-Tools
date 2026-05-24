/**
 * CORS 来源解析与校验模块
 * middleware.js 和 server.js 共用，避免逻辑漂移
 */

const DEFAULT_ALLOWED_ORIGIN = 'https://esim.cosr.eu.org';

function parseOrigins(allowedOrigin) {
  const raw = allowedOrigin || DEFAULT_ALLOWED_ORIGIN;
  const list = raw.split(',').map(o => o.trim()).filter(Boolean);
  return {
    list,
    allowAll: list.includes('*')
  };
}

function isAllowedOrigin(origin, origins) {
  if (!origin) return true;
  if (origins.allowAll) return true;
  return origins.list.includes(origin);
}

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
