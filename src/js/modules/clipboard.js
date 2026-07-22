'use strict';

/**
 * 剪贴板工具
 * Giffgaff / Simyo 共用
 *
 * 注意：从 DevTools 控制台调用时 document 往往未聚焦，
 * navigator.clipboard.writeText 会抛 NotAllowedError，需降级到 execCommand。
 */

/**
 * 通过隐藏 textarea + execCommand 复制（兼容失焦/非 secure 场景）
 * @param {string} text
 * @returns {boolean} 是否成功
 */
function copyViaExecCommand(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // 避免滚动跳动；部分浏览器要求节点可见可选中
  textarea.setAttribute('readonly', '');
  textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;';
  document.body.appendChild(textarea);

  let ok = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    ok = document.execCommand('copy');
  } catch (_) {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return ok;
}

/**
 * 复制文本到剪贴板
 * 优先 Clipboard API，失败（含 Document is not focused）时降级 execCommand
 *
 * @param {string} text - 要复制的文本
 * @returns {Promise<{ method: 'clipboard'|'execCommand' }>}
 */
export async function copyToClipboard(text) {
  const value = text == null ? '' : String(text);

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return { method: 'clipboard' };
    } catch (_) {
      // 常见：NotAllowedError — Document is not focused（控制台调用）
      // 继续降级，不向上抛
    }
  }

  if (copyViaExecCommand(value)) {
    return { method: 'execCommand' };
  }

  const err = new Error('Clipboard write failed (page not focused or copy denied)');
  err.name = 'ClipboardError';
  throw err;
}

export default copyToClipboard;
