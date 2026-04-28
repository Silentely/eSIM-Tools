[根目录](../../../CLAUDE.md) > [src/js](../) > **modules**

# 通用工具模块

## 模块职责

提供可复用的前端工具模块，被 Giffgaff 和 Simyo 业务模块共同依赖。

## 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| **Logger** | `logger.js` | 环境感知日志 (生产环境自动禁用 console.log) |
| **CaptchaManager** | `captcha-manager.js` | 验证码集成 (Turnstile/reCAPTCHA)，自动刷新 |
| **API Service** | `api-service.js` | 统一 HTTP 客户端 (重试/缓存/去重) |
| **HTML Sanitizer** | `html-sanitizer.js` | XSS 防护 (escapeHtml/escapeAttr) |
| **Secure Storage** | `secure-storage.js` | 加密 localStorage (TTL 过期) |
| **Performance Monitor** | `performance-monitor.js` | Core Web Vitals 监控 |
| **i18n** | `i18n.js` + `i18n-data.js` | 国际化支持 |
| **Notification Manager** | `notification-manager.js` | 通知管理 |
| **App Config** | `app-config.js` | 环境配置管理 (特性开关) |
| **Resource Hints** | `resource-hints.js` | 预连接/预加载/预取 |
| **Footer** | `footer.js` | 统一版权页脚注入 |
| **Sentry Init** | `sentry-init.js` | 前端 Sentry 初始化 |
| **Validation** | `middleware/validation.js` | Express 中间件 (请求体/头部/限流) |

## 入口与启动

各模块通过 ES6 import 按需加载，无统一入口。Webpack 别名:
- `@modules` -> `src/js/modules`
- `@utils` -> `src/js/modules/utils`

## 对外接口

### Logger
```javascript
import Logger from './modules/logger.js';
Logger.log('信息');      // 仅开发环境
Logger.warn('警告');     // 始终输出
Logger.error('错误');    // 始终输出
Logger.sensitive('Key', value, 5); // 脱敏
```

### CaptchaManager
```javascript
import captchaManager from './modules/captcha-manager.js';
await captchaManager.init(); // 自动获取配置并初始化
```

### HTML Sanitizer
```javascript
import { sanitizeHTML } from './modules/html-sanitizer.js';
element.innerHTML = sanitizeHTML(userInput);
```

## 测试与质量

- 所有模块设计为可测试 (ES6 import/export)
- 无独立测试文件，通过业务模块测试间接覆盖

## 相关文件清单

- `src/js/modules/logger.js`
- `src/js/modules/captcha-manager.js`
- `src/js/modules/api-service.js`
- `src/js/modules/html-sanitizer.js`
- `src/js/modules/secure-storage.js`
- `src/js/modules/performance-monitor.js`
- `src/js/modules/i18n.js`
- `src/js/modules/notification-manager.js`
- `src/js/modules/app-config.js`
- `src/js/modules/resource-hints.js`
- `src/js/modules/footer.js`
- `src/js/modules/sentry-init.js`
- `src/js/modules/utils.js`
- `src/js/modules/config.js`
- `src/js/middleware/validation.js`
