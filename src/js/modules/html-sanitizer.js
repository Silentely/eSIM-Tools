/**
 * HTML 清理和转义工具模块
 * 防御 XSS 攻击
 */

class HTMLSanitizer {
  /**
   * 转义 HTML 特殊字符
   * @param {string} unsafe - 不安全的字符串
   * @returns {string} 转义后的安全字符串
   */
  static escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';

    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\//g, '&#x2F;'); // 额外转义斜杠
  }

  /**
   * 转义 HTML 属性值
   * @param {string} value - 属性值
   * @returns {string} 转义后的属性值
   */
  static escapeAttr(value) {
    if (value === null || value === undefined) return '';

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * 移除所有 HTML 标签
   * @param {string} html - 包含 HTML 的字符串
   * @returns {string} 纯文本
   */
  static stripTags(html) {
    if (html === null || html === undefined) return '';

    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.textContent || temp.innerText || '';
  }

  /**
   * 清理 HTML，仅保留安全标签
   * @param {string} html - 待清理的 HTML
   * @param {string[]} allowedTags - 允许的标签列表
   * @returns {string} 清理后的 HTML
   */
  static sanitize(html, allowedTags = ['b', 'i', 'em', 'strong', 'span']) {
    if (html === null || html === undefined) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // 递归清理节点
    const cleanNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        // 如果不在白名单中，替换为文本内容
        if (!allowedTags.includes(tagName)) {
          const textNode = document.createTextNode(node.textContent);
          return textNode;
        }

        // 移除所有属性（防止 on* 事件处理器）
        Array.from(node.attributes).forEach(attr => {
          node.removeAttribute(attr.name);
        });

        // 递归清理子节点
        Array.from(node.childNodes).forEach(child => {
          const cleaned = cleanNode(child);
          if (cleaned !== child) {
            node.replaceChild(cleaned, child);
          }
        });

        return node;
      }

      // 移除注释等其他节点
      return document.createTextNode('');
    };

    Array.from(temp.childNodes).forEach(child => {
      cleanNode(child);
    });

    return temp.innerHTML;
  }

  /**
   * 安全地设置 innerHTML
   * @param {HTMLElement} element - 目标元素
   * @param {string} html - HTML 内容
   * @param {string[]} allowedTags - 允许的标签
   */
  static setInnerHTML(element, html, allowedTags) {
    if (!element) {
      console.error('[HTMLSanitizer] Invalid element');
      return;
    }

    const sanitized = this.sanitize(html, allowedTags);
    element.innerHTML = sanitized;
  }

  /**
   * 创建安全的 DOM 节点
   * @param {string} tag - 标签名
   * @param {Object} attributes - 属性对象
   * @param {string|HTMLElement[]} children - 子元素
   * @returns {HTMLElement}
   */
  static createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);

    // 设置属性（自动转义）
    Object.entries(attributes).forEach(([key, value]) => {
      // 禁止设置事件处理器
      if (key.startsWith('on')) {
        console.warn(`[HTMLSanitizer] Blocked event handler: ${key}`);
        return;
      }

      // 转义属性值
      element.setAttribute(key, this.escapeAttr(value));
    });

    // 添加子元素
    const childArray = Array.isArray(children) ? children : [children];
    childArray.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof HTMLElement) {
        element.appendChild(child);
      }
    });

    return element;
  }

  /**
   * 验证 URL 安全性
   * @param {string} url - 待验证的 URL
   * @returns {boolean} 是否安全
   */
  static isSafeURL(url) {
    if (!url) return false;

    try {
      const parsed = new URL(url, window.location.href);
      // 仅允许 http(s) 和 data: 协议
      const safeProtocols = ['http:', 'https:', 'data:'];
      return safeProtocols.includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * 清理 URL（移除 javascript: 等危险协议）
   * @param {string} url - 待清理的 URL
   * @returns {string} 清理后的 URL
   */
  static sanitizeURL(url) {
    if (!url) return '';

    // 移除 javascript:, data:text/html 等危险协议
    const dangerousProtocols = /^(javascript|data:text\/html|vbscript):/i;
    if (dangerousProtocols.test(url)) {
      console.warn('[HTMLSanitizer] Blocked dangerous URL:', url);
      return '#';
    }

    return url;
  }
}

export default HTMLSanitizer;
