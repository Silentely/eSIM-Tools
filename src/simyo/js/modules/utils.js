/**
 * Simyo工具函数模块
 * 提供通用的辅助函数
 */

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
 * 复制到剪贴板
 * @param {string} text - 要复制的文本
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
 * @param {string} message - 通知消息
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
 * 打开帮助对话框
 */
export function openHelp() {
    const helpContent = `
        <div style="max-width: 600px; margin: 20px auto; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <h3 style="color: #ff6b00; margin-bottom: 20px;"><i class="fas fa-question-circle"></i> Simyo eSIM 使用帮助</h3>
            
            <h5>📱 初次注册并安装</h5>
            <p>1. 输入您的Simyo账户信息登录<br>
            2. 获取eSIM配置信息<br>
            3. 生成二维码并在设备上扫描安装<br>
            4. （可选）确认安装状态</p>
            
            <h5>🔄 更换设备</h5>
            <p>1. 在Simyo APP中申请更换设备/eSIM<br>
            2. 填写验证码后停留在界面上<br>
            3. 使用本工具生成新二维码<br>
            4. 新设备扫码安装并启用<br>
            5. 使用第4步确认安装</p>
            
            <h5>💰 保号服务</h5>
            <p>账户持有人: Simyo<br>
            IBAN: NL19INGB0007811670<br>
            金额: 0.01欧元<br>
            备注: 您的Simyo号码（06开头）</p>
            
            <button onclick="this.parentElement.remove()" style="margin-top: 20px; padding: 10px 20px; background: #ff6b00; color: white; border: none; border-radius: 8px; cursor: pointer;">
                关闭帮助
            </button>
        </div>
    `;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); z-index: 1000; display: flex;
        align-items: center; justify-content: center; padding: 20px;
    `;
    overlay.innerHTML = helpContent;
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
    return window.location.hostname.includes('netlify') || 
           window.location.hostname.includes('cosr.eu.org') ||
           window.location.hostname.includes('yyxx.com');
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