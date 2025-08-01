/**
 * 安全认证服务 - 前端接口层
 * 所有敏感操作通过后端API执行
 */

class SecureAuthService {
    constructor() {
        this.baseUrl = this.detectEnvironment();
        this.sessionId = this.generateSessionId();
        this.initAntiDebug();
    }

    detectEnvironment() {
        const hostname = window.location.hostname;
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
            return 'http://localhost:3000';
        }
        return ''; // 相对路径，使用当前域名
    }

    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 防调试和代码保护
    initAntiDebug() {
        // 禁用右键菜单
        document.addEventListener('contextmenu', e => e.preventDefault());
        
        // 禁用开发者工具快捷键
        document.addEventListener('keydown', e => {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.shiftKey && e.key === 'C') ||
                (e.ctrlKey && e.key === 'U')) {
                e.preventDefault();
                this.showSecurityWarning();
            }
        });

        // 检测开发者工具
        setInterval(() => {
            const start = performance.now();
            debugger;
            const end = performance.now();
            if (end - start > 100) {
                this.handleDebugDetection();
            }
        }, 1000);

        // 防止选择文本
        document.onselectstart = () => false;
        document.ondragstart = () => false;
    }

    showSecurityWarning() {
        alert('⚠️ 安全警告：此应用受到保护，禁止查看源代码或调试。');
    }

    handleDebugDetection() {
        document.body.innerHTML = '<div style="text-align:center;padding:50px;font-size:24px;color:red;">⚠️ 检测到调试工具，页面已被保护</div>';
        window.location.href = 'about:blank';
    }

    // 安全的API调用方法
    async secureRequest(endpoint, data = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/api/secure/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId,
                    'X-Timestamp': Date.now(),
                    'X-Signature': await this.generateSignature(data)
                },
                body: JSON.stringify({
                    ...data,
                    sessionId: this.sessionId,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                throw new Error(`安全请求失败: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('安全请求错误:', error);
            throw new Error('请求失败，请稍后重试');
        }
    }

    async generateSignature(data) {
        // 简单的签名生成（生产环境应使用更强的加密）
        const message = JSON.stringify(data) + this.sessionId;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Giffgaff OAuth登录（安全版本）
    async initiateGiffgaffOAuth() {
        return await this.secureRequest('giffgaff/oauth/initiate');
    }

    async completeGiffgaffOAuth(callbackUrl) {
        return await this.secureRequest('giffgaff/oauth/complete', { callbackUrl });
    }

    // Giffgaff MFA验证（安全版本）
    async sendMFACode(accessToken) {
        return await this.secureRequest('giffgaff/mfa/send', { accessToken });
    }

    async verifyMFACode(accessToken, code, ref) {
        return await this.secureRequest('giffgaff/mfa/verify', { accessToken, code, ref });
    }

    // Giffgaff eSIM操作（安全版本）
    async getMemberInfo(accessToken, mfaSignature) {
        return await this.secureRequest('giffgaff/member/info', { accessToken, mfaSignature });
    }

    async reserveESIM(accessToken, mfaSignature) {
        return await this.secureRequest('giffgaff/esim/reserve', { accessToken, mfaSignature });
    }

    async swapSIM(accessToken, mfaSignature, targetSSN) {
        return await this.secureRequest('giffgaff/esim/swap', { accessToken, mfaSignature, targetSSN });
    }

    async getESIMToken(accessToken, mfaSignature, ssn) {
        return await this.secureRequest('giffgaff/esim/token', { accessToken, mfaSignature, ssn });
    }

    // Simyo登录（安全版本）
    async simyoLogin(phoneNumber, password) {
        // 密码在传输前进行简单加密
        const encryptedPassword = await this.encryptPassword(password);
        return await this.secureRequest('simyo/login', { phoneNumber, password: encryptedPassword });
    }

    async encryptPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + this.sessionId);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Simyo eSIM操作（安全版本）
    async getSimyoESIM(sessionToken) {
        return await this.secureRequest('simyo/esim/get', { sessionToken });
    }

    async applyNewSimyoESIM(sessionToken, isDeviceChange = false) {
        return await this.secureRequest('simyo/esim/apply', { sessionToken, isDeviceChange });
    }

    async sendSimyoSMSCode(sessionToken) {
        return await this.secureRequest('simyo/sms/send', { sessionToken });
    }

    async verifySimyoCode(sessionToken, code) {
        return await this.secureRequest('simyo/sms/verify', { sessionToken, code });
    }

    async confirmSimyoInstall(sessionToken, activationCode) {
        return await this.secureRequest('simyo/esim/confirm', { sessionToken, activationCode });
    }

    // 生成二维码（安全版本）
    async generateQRCode(lpaString) {
        return await this.secureRequest('qrcode/generate', { lpaString });
    }

    // 清理敏感数据
    clearSensitiveData() {
        // 清理内存中的敏感信息
        this.sessionId = null;
        
        // 清理localStorage和sessionStorage
        localStorage.clear();
        sessionStorage.clear();
        
        // 清理表单数据
        document.querySelectorAll('input[type="password"]').forEach(input => {
            input.value = '';
        });
    }
}

// 导出安全服务实例
window.SecureAuthService = new SecureAuthService();