/**
 * HTMLSanitizer 模块单元测试
 * 覆盖 XSS 防护、HTML 转义、URL 安全验证等核心功能
 */

import HTMLSanitizer from '../../src/js/modules/html-sanitizer';

describe('HTMLSanitizer', () => {
  describe('escapeHtml()', () => {
    it('应该转义所有 HTML 特殊字符', () => {
      const input = '<script>alert("xss")</script>';
      const result = HTMLSanitizer.escapeHtml(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    it('应该转义 & 符号', () => {
      expect(HTMLSanitizer.escapeHtml('a&b')).toBe('a&amp;b');
    });

    it('应该转义引号', () => {
      expect(HTMLSanitizer.escapeHtml('"test"')).toBe('&quot;test&quot;');
      expect(HTMLSanitizer.escapeHtml("'test'")).toBe('&#039;test&#039;');
    });

    it('应该转义斜杠', () => {
      expect(HTMLSanitizer.escapeHtml('/path')).toBe('&#x2F;path');
    });

    it('应该处理 null 和 undefined', () => {
      expect(HTMLSanitizer.escapeHtml(null)).toBe('');
      expect(HTMLSanitizer.escapeHtml(undefined)).toBe('');
    });

    it('应该处理数字类型', () => {
      expect(HTMLSanitizer.escapeHtml(123)).toBe('123');
    });

    it('应该处理空字符串', () => {
      expect(HTMLSanitizer.escapeHtml('')).toBe('');
    });
  });

  describe('escapeAttr()', () => {
    it('应该转义属性值中的引号', () => {
      expect(HTMLSanitizer.escapeAttr('value"onclick="alert(1)')).toBe('value&quot;onclick=&quot;alert(1)');
    });

    it('应该转义单引号', () => {
      expect(HTMLSanitizer.escapeAttr("it's")).toBe('it&#x27;s');
    });

    it('应该处理 null 和 undefined', () => {
      expect(HTMLSanitizer.escapeAttr(null)).toBe('');
      expect(HTMLSanitizer.escapeAttr(undefined)).toBe('');
    });

    it('应该转义尖括号', () => {
      expect(HTMLSanitizer.escapeAttr('<img>')).toBe('&lt;img&gt;');
    });
  });

  describe('sanitizeURL()', () => {
    it('应该阻止 javascript: 协议', () => {
      expect(HTMLSanitizer.sanitizeURL('javascript:alert(1)')).toBe('#');
    });

    it('应该阻止 vbscript: 协议', () => {
      expect(HTMLSanitizer.sanitizeURL('vbscript:msgbox(1)')).toBe('#');
    });

    it('应该阻止 data:text/html 协议', () => {
      // 使用不含尖括号的字符串避免 jsdom 解析干扰
      const result = HTMLSanitizer.sanitizeURL('data:text/html,hello');
      expect(result).toBe('#');
    });

    it('应该允许 http: 协议', () => {
      expect(HTMLSanitizer.sanitizeURL('http://example.com')).toBe('http://example.com');
    });

    it('应该允许 https: 协议', () => {
      expect(HTMLSanitizer.sanitizeURL('https://example.com')).toBe('https://example.com');
    });

    it('应该处理空值', () => {
      expect(HTMLSanitizer.sanitizeURL('')).toBe('');
      expect(HTMLSanitizer.sanitizeURL(null)).toBe('');
    });
  });

  describe('isSafeURL()', () => {
    it('应该允许 http 协议', () => {
      expect(HTMLSanitizer.isSafeURL('http://example.com')).toBe(true);
    });

    it('应该允许 https 协议', () => {
      expect(HTMLSanitizer.isSafeURL('https://example.com')).toBe(true);
    });

    it('应该阻止 javascript: 协议', () => {
      expect(HTMLSanitizer.isSafeURL('javascript:alert(1)')).toBe(false);
    });

    it('应该阻止 file: 协议', () => {
      expect(HTMLSanitizer.isSafeURL('file:///etc/passwd')).toBe(false);
    });

    it('应该处理空值', () => {
      expect(HTMLSanitizer.isSafeURL('')).toBe(false);
      expect(HTMLSanitizer.isSafeURL(null)).toBe(false);
    });
  });

  describe('setInnerHTML()', () => {
    it('应该安全地设置 innerHTML', () => {
      const element = document.createElement('div');
      HTMLSanitizer.setInnerHTML(element, '<b>bold</b>', ['b']);
      expect(element.innerHTML).toBe('<b>bold</b>');
    });

    it('应该移除不在白名单中的标签并保留文本', () => {
      const element = document.createElement('div');
      HTMLSanitizer.setInnerHTML(element, '<script>bad</script><b>safe</b>', ['b']);
      // 脚本标签应被替换为文本节点，安全标签保留
      expect(element.textContent).toContain('bad');
      expect(element.textContent).toContain('safe');
      expect(element.querySelector('b')).not.toBeNull();
    });

    it('应该处理 null 元素', () => {
      expect(() => {
        HTMLSanitizer.setInnerHTML(null, '<b>test</b>');
      }).not.toThrow();
    });
  });

  describe('createElement()', () => {
    it('应该创建带安全属性的元素', () => {
      const el = HTMLSanitizer.createElement('div', { id: 'test', class: 'foo' }, 'hello');
      expect(el.tagName).toBe('DIV');
      expect(el.id).toBe('test');
      expect(el.textContent).toBe('hello');
    });

    it('应该阻止事件处理器属性', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const el = HTMLSanitizer.createElement('div', { onclick: 'alert(1)' });
      expect(el.hasAttribute('onclick')).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('应该支持子元素数组', () => {
      const child = document.createElement('span');
      const el = HTMLSanitizer.createElement('div', {}, [child, 'text']);
      expect(el.children.length).toBe(1);
      expect(el.childNodes.length).toBe(2);
    });
  });
});
