'use strict';

/**
 * 诊断信息导出
 * 供用户在控制台执行 copyEsimDiagnostics()，将非敏感环境信息复制到 Issue。
 * 不包含 token / 密码 / cookie / LPA 等敏感字段。
 *
 * 控制台用法：
 *   await copyEsimDiagnostics()
 * 若剪贴板因页面失焦失败，仍会在控制台打印全文，可手动复制；不会抛未处理 rejection。
 */

import { copyToClipboard } from './clipboard.js';

const SENSITIVE_KEY_RE = /token|password|cookie|secret|signature|verifier|lpa|activation|ssn|authorization/i;

/**
 * 脱敏对象：剔除敏感键，截断过长字符串
 * @param {Object} source
 * @param {number} maxDepth
 * @returns {Object}
 */
function sanitizeObject(source, maxDepth = 2) {
  if (!source || typeof source !== 'object' || maxDepth < 0) {
    return {};
  }

  const out = {};
  Object.keys(source).forEach((key) => {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = '[redacted]';
      return;
    }
    const value = source[key];
    if (value == null) {
      out[key] = value;
    } else if (typeof value === 'string') {
      out[key] = value.length > 120 ? `${value.slice(0, 120)}…(len=${value.length})` : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'object' && maxDepth > 0) {
      out[key] = sanitizeObject(value, maxDepth - 1);
    } else {
      out[key] = `[${typeof value}]`;
    }
  });
  return out;
}

/**
 * 收集诊断快照
 * @param {Object} [options]
 * @param {string} [options.app] - 应用标识 giffgaff|simyo|home
 * @param {Object} [options.state] - 可选业务状态（会脱敏）
 * @returns {Object}
 */
export function collectDiagnostics(options = {}) {
  const { app = 'unknown', state = null } = options;
  const loc = typeof window !== 'undefined' ? window.location : null;
  const nav = typeof navigator !== 'undefined' ? navigator : null;

  return {
    generatedAt: new Date().toISOString(),
    app,
    page: {
      href: loc ? loc.href : '',
      hostname: loc ? loc.hostname : '',
      pathname: loc ? loc.pathname : '',
      protocol: loc ? loc.protocol : ''
    },
    runtime: {
      userAgent: nav ? nav.userAgent : '',
      language: nav ? nav.language : '',
      online: nav ? nav.onLine : null,
      cookieEnabled: nav ? nav.cookieEnabled : null,
      viewport: typeof window !== 'undefined'
        ? { w: window.innerWidth, h: window.innerHeight }
        : null
    },
    state: state ? sanitizeObject(state) : null
  };
}

/**
 * 格式化为适合粘贴到 Issue 的文本
 * @param {Object} [options]
 * @returns {string}
 */
export function formatDiagnostics(options = {}) {
  const payload = collectDiagnostics(options);
  return [
    '```json',
    '// eSIM Tools 诊断信息（已脱敏，可直接贴到 Issue）',
    JSON.stringify(payload, null, 2),
    '```'
  ].join('\n');
}

/**
 * 复制诊断信息到剪贴板
 * @param {Object} [options]
 * @returns {Promise<{ text: string, copied: boolean, method: string|null, error: string|null }>}
 */
export async function copyDiagnostics(options = {}) {
  const text = formatDiagnostics(options);
  try {
    const result = await copyToClipboard(text);
    return {
      text,
      copied: true,
      method: result && result.method ? result.method : 'clipboard',
      error: null
    };
  } catch (error) {
    return {
      text,
      copied: false,
      method: null,
      error: error && error.message ? error.message : String(error)
    };
  }
}

/**
 * 挂到 window，便于控制台：copyEsimDiagnostics()
 * @param {Object} [options]
 */
export function installDiagnosticsGlobal(options = {}) {
  if (typeof window === 'undefined') return;

  const getter = typeof options.getState === 'function' ? options.getState : null;
  const app = options.app || 'unknown';

  /**
   * 控制台入口：尽量复制；失败时仍打印全文，永不抛出（避免 Sentry unhandledrejection）
   * @returns {Promise<{ text: string, copied: boolean, method: string|null, error: string|null }>}
   */
  window.copyEsimDiagnostics = async function copyEsimDiagnostics() {
    const state = getter ? getter() : null;
    const result = await copyDiagnostics({ app, state });

    if (result.copied) {
      console.log(
        `[eSIM Diagnostics] 已复制到剪贴板（method=${result.method}，敏感字段已脱敏）\n`,
        result.text
      );
    } else {
      // 控制台调用时页面常失焦：写剪贴板会失败，改为打印全文供手动复制
      console.warn(
        '[eSIM Diagnostics] 自动复制失败（常见原因：焦点在 DevTools，Document is not focused）。\n' +
          '请先点击页面任意处再执行 copyEsimDiagnostics()，或直接从下方输出手动复制：\n',
        result.error || ''
      );
      console.log(result.text);
    }

    return result;
  };

  window.__esimDiagnostics = {
    collect: () => collectDiagnostics({
      app,
      state: getter ? getter() : null
    }),
    format: () => formatDiagnostics({
      app,
      state: getter ? getter() : null
    }),
    copy: window.copyEsimDiagnostics
  };
}

export default {
  collectDiagnostics,
  formatDiagnostics,
  copyDiagnostics,
  installDiagnosticsGlobal
};
