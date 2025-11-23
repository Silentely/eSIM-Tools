# 代码风格与约定
- JavaScript 采用 ES6+ 模块化与 Webpack alias（`@modules`, `@utils` 等），入口 `src/js/main.js` 注重单一职责；公用逻辑放在 `src/js/modules/` 与 `middleware/`，优先复用 debounce/throttle、API service、performance monitor 等工具以符合 DRY。
- 所有网络调用必须经过封装的 API service（含重试、缓存、去重）或 Netlify Function 代理，禁止在 UI 组件内直接写裸 `fetch`；Simyo 代理需保留必要头部与日志。
- UI 主要基于 Bootstrap 5 + 自定义 CSS（`src/styles/`），遵循响应式与 mobile-first 设计；懒加载图片以 `data-src` 搭配 `performance.js` 的 Intersection Observer。
- 安全默认开启：严格 CSP、Cloudflare Turnstile token、输入验证（手机号/验证码/ Cookie）、中间件限流与 XSS 清理；新增逻辑需沿用 `src/js/middleware` 的校验与错误边界。
- Service Worker + Workbox 负责缓存策略，新增资源需更新 `sw.js` 预缓存清单并维持 500KB bundle 预算；脚本中使用 `console` 需守护日志噪音（已有 performance dashboard，可复用）。
- Node/Netlify Functions 暴露 `handler` 并保持纯函数式输入/输出；Express 本地服务器使用 `wrapNetlifyFunction` 包装，新增函数需注册路由且遵循 30s timeout、统一错误响应结构。
- 注释倾向解释意图（为何这样设计），避免冗余；命名沿用 provider + action 语义（如 `giffgaffSmsActivate`, `simyoDeviceFlow`）。