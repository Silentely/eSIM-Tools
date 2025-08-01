/**
 * 防抓取和反调试保护模块
 * 实现多层安全防护机制
 */

(function() {
    'use strict';

    // 防调试检测
    const AntiDebug = {
        // 检测开发者工具
        detectDevTools: function() {
            const threshold = 160;
            setInterval(function() {
                if (window.outerHeight - window.innerHeight > threshold || 
                    window.outerWidth - window.innerWidth > threshold) {
                    AntiDebug.triggerProtection();
                }
            }, 500);
        },

        // 检测控制台
        detectConsole: function() {
            let devtools = {
                open: false,
                orientation: null
            };
            
            const element = new Image();
            Object.defineProperty(element, 'id', {
                get: function() {
                    devtools.open = true;
                    AntiDebug.triggerProtection();
                }
            });
            
            setInterval(function() {
                devtools.open = false;
                console.dir(element);
                console.clear && console.clear();
            }, 1000);
        },

        // 检测调试器
        detectDebugger: function() {
            setInterval(function() {
                const start = performance.now();
                debugger;
                const end = performance.now();
                if (end - start > 100) {
                    AntiDebug.triggerProtection();
                }
            }, 1000);
        },

        // 触发保护机制
        triggerProtection: function() {
            document.body.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #000;
                    color: #ff0000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    z-index: 999999;
                ">
                    <div style="text-align: center;">
                        <h1>⚠️ 安全保护已激活</h1>
                        <p>检测到调试工具，页面已被保护</p>
                        <p>Security Protection Activated</p>
                    </div>
                </div>
            `;
            
            // 阻止进一步操作
            setTimeout(() => {
                window.location.href = 'about:blank';
            }, 3000);
        }
    };

    // 防复制和选择
    const AntiCopy = {
        init: function() {
            // 禁用右键菜单
            document.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                AntiCopy.showWarning();
                return false;
            });

            // 禁用文本选择
            document.addEventListener('selectstart', function(e) {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    return false;
                }
            });

            // 禁用拖拽
            document.addEventListener('dragstart', function(e) {
                e.preventDefault();
                return false;
            });

            // 禁用快捷键
            document.addEventListener('keydown', function(e) {
                // F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+U, Ctrl+S, Ctrl+A, Ctrl+C, Ctrl+V
                if (e.key === 'F12' || 
                    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C')) ||
                    (e.ctrlKey && (e.key === 'u' || e.key === 'U' || 
                                   e.key === 's' || e.key === 'S' ||
                                   e.key === 'a' || e.key === 'A' ||
                                   e.key === 'c' || e.key === 'C' ||
                                   e.key === 'v' || e.key === 'V'))) {
                    e.preventDefault();
                    AntiCopy.showWarning();
                    return false;
                }
            });

            // 禁用打印
            window.addEventListener('beforeprint', function(e) {
                e.preventDefault();
                AntiCopy.showWarning();
                return false;
            });
        },

        showWarning: function() {
            const warning = document.createElement('div');
            warning.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff4444;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                z-index: 999999;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            warning.textContent = '⚠️ 此内容受版权保护，禁止复制';
            document.body.appendChild(warning);
            
            setTimeout(() => {
                document.body.removeChild(warning);
            }, 3000);
        }
    };

    // 防爬虫和自动化检测
    const AntiBot = {
        init: function() {
            // 检测无头浏览器
            this.detectHeadless();
            
            // 检测自动化工具
            this.detectAutomation();
            
            // 检测异常行为
            this.detectAbnormalBehavior();
        },

        detectHeadless: function() {
            // 检测Chrome无头模式
            if (navigator.webdriver || 
                window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect ||
                navigator.plugins.length === 0 ||
                navigator.languages.length === 0) {
                this.blockAccess('检测到自动化工具');
            }

            // 检测PhantomJS
            if (window.callPhantom || window._phantom) {
                this.blockAccess('检测到PhantomJS');
            }

            // 检测Selenium
            if (window.document.$cdc_asdjflasutopfhvcZLmcfl_ ||
                window.document.documentElement.getAttribute('selenium') ||
                window.document.documentElement.getAttribute('webdriver') ||
                window.document.documentElement.getAttribute('driver')) {
                this.blockAccess('检测到Selenium');
            }
        },

        detectAutomation: function() {
            // 检测异常的用户代理
            const ua = navigator.userAgent.toLowerCase();
            const botPatterns = [
                'bot', 'crawler', 'spider', 'scraper', 'headless',
                'phantom', 'selenium', 'puppeteer', 'playwright'
            ];
            
            for (let pattern of botPatterns) {
                if (ua.includes(pattern)) {
                    this.blockAccess('检测到爬虫用户代理');
                }
            }

            // 检测异常的屏幕分辨率
            if (screen.width === 0 || screen.height === 0 ||
                screen.availWidth === 0 || screen.availHeight === 0) {
                this.blockAccess('检测到异常屏幕分辨率');
            }
        },

        detectAbnormalBehavior: function() {
            let clickCount = 0;
            let lastClickTime = 0;
            
            document.addEventListener('click', function() {
                const now = Date.now();
                if (now - lastClickTime < 100) { // 点击间隔小于100ms
                    clickCount++;
                    if (clickCount > 10) {
                        AntiBot.blockAccess('检测到异常点击行为');
                    }
                } else {
                    clickCount = 0;
                }
                lastClickTime = now;
            });

            // 检测异常快速的表单填写
            const inputs = document.querySelectorAll('input');
            inputs.forEach(input => {
                let lastInputTime = 0;
                input.addEventListener('input', function() {
                    const now = Date.now();
                    if (now - lastInputTime < 50 && this.value.length > 5) {
                        AntiBot.blockAccess('检测到异常输入行为');
                    }
                    lastInputTime = now;
                });
            });
        },

        blockAccess: function(reason) {
            console.warn('访问被阻止:', reason);
            document.body.innerHTML = `
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    background: #f8f9fa;
                    font-family: Arial, sans-serif;
                ">
                    <div style="text-align: center; padding: 40px;">
                        <h1 style="color: #dc3545; margin-bottom: 20px;">🚫 访问被拒绝</h1>
                        <p style="color: #6c757d; font-size: 18px;">检测到异常访问行为</p>
                        <p style="color: #6c757d;">Access Denied - Abnormal Behavior Detected</p>
                        <hr style="margin: 30px 0;">
                        <p style="color: #6c757d; font-size: 14px;">如果您是正常用户，请使用标准浏览器访问</p>
                    </div>
                </div>
            `;
            
            // 阻止进一步操作
            setTimeout(() => {
                window.location.href = 'about:blank';
            }, 5000);
        }
    };

    // 代码混淆和保护
    const CodeProtection = {
        init: function() {
            // 重写console方法
            this.disableConsole();
            
            // 检测源码查看
            this.detectViewSource();
            
            // 混淆全局对象
            this.obfuscateGlobals();
        },

        disableConsole: function() {
            const noop = function() {};
            const methods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'trace', 'dir', 'dirxml', 'group', 'groupEnd', 'time', 'timeEnd', 'profile', 'profileEnd', 'clear'];
            
            methods.forEach(method => {
                console[method] = noop;
            });
        },

        detectViewSource: function() {
            // 检测Ctrl+U
            document.addEventListener('keydown', function(e) {
                if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
                    e.preventDefault();
                    CodeProtection.showSourceWarning();
                    return false;
                }
            });
        },

        showSourceWarning: function() {
            alert('⚠️ 源代码查看被禁止\n此应用受版权保护');
        },

        obfuscateGlobals: function() {
            // 创建假的全局变量来迷惑逆向工程
            window._0x1a2b3c = 'fake_data';
            window._0x4d5e6f = function() { return false; };
            window._0x7g8h9i = { fake: true, data: 'obfuscated' };
        }
    };

    // 网络请求保护
    const NetworkProtection = {
        init: function() {
            // 监控异常请求
            this.monitorRequests();
            
            // 限制请求频率
            this.rateLimitRequests();
        },

        monitorRequests: function() {
            const originalFetch = window.fetch;
            let requestCount = 0;
            let lastRequestTime = 0;
            
            window.fetch = function(...args) {
                const now = Date.now();
                requestCount++;
                
                // 检测异常频繁的请求
                if (now - lastRequestTime < 1000 && requestCount > 5) {
                    console.warn('异常请求频率检测');
                    return Promise.reject(new Error('请求被限制'));
                }
                
                if (now - lastRequestTime > 5000) {
                    requestCount = 0;
                }
                
                lastRequestTime = now;
                return originalFetch.apply(this, args);
            };
        },

        rateLimitRequests: function() {
            const requestTimes = [];
            const maxRequestsPerMinute = 30;
            
            const originalXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function() {
                const now = Date.now();
                requestTimes.push(now);
                
                // 清理超过1分钟的记录
                while (requestTimes.length > 0 && now - requestTimes[0] > 60000) {
                    requestTimes.shift();
                }
                
                // 检查请求频率
                if (requestTimes.length > maxRequestsPerMinute) {
                    throw new Error('请求频率超限');
                }
                
                return originalXHROpen.apply(this, arguments);
            };
        }
    };

    // 初始化所有保护机制
    function initializeProtection() {
        try {
            AntiDebug.detectDevTools();
            AntiDebug.detectConsole();
            AntiDebug.detectDebugger();
            
            AntiCopy.init();
            AntiBot.init();
            CodeProtection.init();
            NetworkProtection.init();
            
            console.log('🔒 安全保护已激活');
        } catch (error) {
            console.error('安全保护初始化失败:', error);
        }
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeProtection);
    } else {
        initializeProtection();
    }

    // 导出到全局（混淆名称）
    window._$security_module_$_ = {
        reinit: initializeProtection,
        version: '2.0.0'
    };

})();