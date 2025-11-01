/**
 * 工具函数模块
 * 提供通用的辅助函数
 */
import { tl } from '../../../js/modules/i18n.js';

/**
 * 生成PKCE Code Verifier
 */
export function generateCodeVerifier() {
    const array = new Uint8Array(96);
    crypto.getRandomValues(array);
    const verifier = btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    
    return verifier.length >= 43 ? verifier.substr(0, 128) : verifier + 'a'.repeat(43 - verifier.length);
}

/**
 * 生成PKCE Code Challenge
 */
export async function generateCodeChallenge(verifier) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode.apply(null, new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * 生成随机State
 */
export function generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * 检查是否在服务时间内（英国时间 04:30-21:30）
 */
export function isServiceTimeAvailable() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(now);
    
    const ukHour = parseInt((parts.find(p => p.type === 'hour') || {}).value || '0', 10);
    const ukMinute = parseInt((parts.find(p => p.type === 'minute') || {}).value || '0', 10);
    
    const minutesSinceMidnight = ukHour * 60 + ukMinute;
    const start = 4 * 60 + 30;   // 04:30
    const end = 21 * 60 + 30;    // 21:30
    
    return minutesSinceMidnight >= start && minutesSinceMidnight <= end;
}

/**
 * 显示服务时间警告对话框
 */
export function showServiceTimeWarning() {
    return new Promise((resolve) => {
        const warningMessage = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                <h4 style="color: #dc2626; margin-bottom: 15px;">${tl('非SIM申请服务时间')}</h4>
                <p style="color: #374151; margin-bottom: 20px; line-height: 1.6;">
                    ${tl('服务窗口提示')}
                </p>
                <p style="color: #dc2626; font-weight: 600; margin-bottom: 20px;">
                    ${tl('继续操作警告')}
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="continueAnyway" style="
                        background: #dc2626; 
                        color: white; 
                        border: none; 
                        padding: 10px 20px; 
                        border-radius: 8px; 
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">${tl('仍要继续')}</button>
                    <button id="cancelOperation" style="
                        background: #6b7280; 
                        color: white; 
                        border: none; 
                        padding: 10px 20px; 
                        border-radius: 8px; 
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">${tl('取消操作')}</button>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 16px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: modalSlideIn 0.3s ease-out;
        `;
        modalContent.innerHTML = warningMessage;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        document.getElementById('continueAnyway').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(true);
        });
        
        document.getElementById('cancelOperation').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve(false);
            }
        });
    });
}

/**
 * 复制到剪贴板
 */
export function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return Promise.resolve();
    }
}

/**
 * 显示Toast通知
 */
export function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-check-circle me-2"></i>
            ${message}
        </div>
    `;
    
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
 * 从code元素复制文本
 */
export function copyTextFromCode(codeElementId, btnEl) {
    const el = document.getElementById(codeElementId);
    if (!el) return;
    
    const text = (el.textContent || '').trim();
    if (!text) return;
    
    copyToClipboard(text).then(() => {
        if (btnEl) {
            const old = btnEl.innerHTML;
            btnEl.innerHTML = `<i class="fas fa-check"></i> ${tl('已复制')}`;
            btnEl.classList.add('btn-success');
            btnEl.classList.remove('btn-outline-primary');
            setTimeout(() => {
                btnEl.innerHTML = old;
                btnEl.classList.remove('btn-success');
                btnEl.classList.add('btn-outline-primary');
            }, 1500);
        }
    }).catch((e) => {
        console.error(tl('复制失败:'), e);
        alert(tl('复制失败，请手动选择文本复制'));
    });
}

/**
 * 打开教程
 */
export function openTutorial() {
    window.open('https://github.com/Silentely/eSIM-Tools/blob/main/docs/User_Guide.md', '_blank');
}

/**
 * 检测环境
 */
export function isNetlifyEnvironment() {
    return window.location.hostname.includes('cosr.eu.org') || 
           window.location.hostname.includes('netlify');
}
