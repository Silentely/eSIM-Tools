/**
 * Simyo 帮助弹窗测试
 */

import { openHelp } from '../../src/simyo/js/modules/utils.js';
import * as i18n from '../../src/js/modules/i18n.js';

describe('Simyo openHelp()', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('点击关闭按钮应移除遮罩层', () => {
    openHelp();

    const overlay = document.querySelector('[data-help-overlay="simyo-help"]');
    expect(overlay).toBeInTheDocument();

    const closeBtn = overlay.querySelector('[data-action="close-help"]');
    expect(closeBtn).toBeInTheDocument();

    closeBtn.click();
    expect(document.querySelector('[data-help-overlay="simyo-help"]')).toBeNull();
  });

  it('点击遮罩空白处应移除遮罩层', () => {
    openHelp();

    const overlay = document.querySelector('[data-help-overlay="simyo-help"]');
    expect(overlay).toBeInTheDocument();

    overlay.click();
    expect(document.querySelector('[data-help-overlay="simyo-help"]')).toBeNull();
  });

  it('帮助文案应作为文本渲染，不执行 HTML', () => {
    jest.spyOn(i18n, 't').mockImplementation((key) => {
      if (key === 'simyo.help.title') return '<img src=x onerror=alert(1)>XSS';
      if (key.endsWith('.heading')) return 'Heading';
      if (key.endsWith('.content')) return '<script>alert(1)</script>';
      if (key === 'simyo.help.close') return 'Close';
      return key;
    });

    openHelp();

    const overlay = document.querySelector('[data-help-overlay="simyo-help"]');
    expect(overlay.querySelector('img[src="x"]')).toBeNull();
    expect(overlay.querySelector('script')).toBeNull();
    expect(overlay.textContent).toContain('<img src=x onerror=alert(1)>XSS');
    expect(overlay.textContent).toContain('<script>alert(1)</script>');

    i18n.t.mockRestore();
  });
});

