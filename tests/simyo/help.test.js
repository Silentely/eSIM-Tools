/**
 * Simyo 帮助弹窗测试
 */

import { openHelp } from '../../src/simyo/js/modules/utils.js';

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
});

