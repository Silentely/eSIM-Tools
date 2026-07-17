import { t, tl } from '../../../js/modules/i18n.js';

/**
 * Simyo工具函数模块
 * 提供通用的辅助函数
 */

// 公共剪贴板实现（保持既有导出路径不变，避免调用方脱链）
export { copyToClipboard } from '../../../js/modules/clipboard.js';

/**
 * 验证荷兰手机号格式
 * @param {string} phoneNumber - 手机号
 * @returns {boolean} 是否有效
 */
export function validatePhoneNumber(phoneNumber) {
    return /^06\d{8}$/.test(phoneNumber);
}

/**
 * 验证验证码格式
 * @param {string} code - 验证码
 * @returns {boolean} 是否有效
 */
export function validateVerificationCode(code) {
    return /^\d{6}$/.test(code);
}

/**
 * 显示Toast通知
 * 使用 textContent 渲染消息，避免接口错误文案经 innerHTML 注入
 * @param {string} message - 通知消息
 */
export function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';

    const content = document.createElement('div');
    content.className = 'toast-content';

    const icon = document.createElement('i');
    icon.className = 'fas fa-check-circle me-2';
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.textContent = message == null ? '' : String(message);

    content.appendChild(icon);
    content.appendChild(text);
    toast.appendChild(content);
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

/**
 * 打开帮助对话框
 * 使用 DOM + textContent，避免 i18n 文案经 innerHTML 注入
 */
export function openHelp() {
    const overlay = document.createElement('div');
    overlay.dataset.helpOverlay = 'simyo-help';
    overlay.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'background: rgba(0,0,0,0.7)',
        'z-index: 1000',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'padding: 20px'
    ].join('; ');

    const card = document.createElement('div');
    card.style.cssText = [
        'max-width: 600px',
        'margin: 20px auto',
        'padding: 20px',
        'background: white',
        'border-radius: 12px',
        'box-shadow: 0 4px 20px rgba(0,0,0,0.1)'
    ].join('; ');

    const title = document.createElement('h3');
    title.style.cssText = 'color: #ff6b00; margin-bottom: 20px;';
    const titleIcon = document.createElement('i');
    titleIcon.className = 'fas fa-question-circle';
    titleIcon.setAttribute('aria-hidden', 'true');
    title.appendChild(titleIcon);
    title.appendChild(document.createTextNode(' ' + t('simyo.help.title')));

    const sections = [
        ['simyo.help.setup.heading', 'simyo.help.setup.content'],
        ['simyo.help.device.heading', 'simyo.help.device.content'],
        ['simyo.help.keep.heading', 'simyo.help.keep.content']
    ];

    card.appendChild(title);
    sections.forEach(([headingKey, contentKey]) => {
        const h5 = document.createElement('h5');
        h5.textContent = t(headingKey);
        const p = document.createElement('p');
        p.textContent = t(contentKey);
        card.appendChild(h5);
        card.appendChild(p);
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.dataset.action = 'close-help';
    closeBtn.style.cssText = [
        'margin-top: 20px',
        'padding: 10px 20px',
        'background: #ff6b00',
        'color: white',
        'border: none',
        'border-radius: 8px',
        'cursor: pointer'
    ].join('; ');
    closeBtn.textContent = t('simyo.help.close');
    closeBtn.addEventListener('click', () => overlay.remove());
    card.appendChild(closeBtn);

    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
}

/**
 * 检测环境
 * @returns {boolean} 是否为Netlify环境
 */
export function isNetlifyEnvironment() {
    const hostname = window.location.hostname;
    return hostname === 'esim.cosr.eu.org' ||
           hostname.endsWith('.netlify.app') ||
           hostname === 'yyxx.com' ||
           hostname.endsWith('.yyxx.com');
}

/**
 * 生成LPA字符串
 * @param {string} activationCode - 激活码
 * @returns {string} LPA字符串
 */
export function generateLPA(activationCode) {
    return `LPA:${activationCode}`;
}

/**
 * 格式化手机号显示
 * @param {string} phoneNumber - 手机号
 * @returns {string} 格式化后的手机号
 */
export function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    // 06 1234 5678 格式
    return phoneNumber.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1 $2 $3');
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
