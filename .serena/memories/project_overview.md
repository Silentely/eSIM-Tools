# eSIM-Tools 项目概览
- 目标：为 Giffgaff（英国）与 Simyo（荷兰）用户提供一站式 eSIM 申请、激活、二维码交付流程，涵盖 OAuth PKCE、MFA、短信激活与 GraphQL API 交互。
- 前端：原生 JavaScript（ES6+ 模块）、Bootstrap 5、PostCSS/Autoprefixer、Service Worker + Workbox 提供 PWA 与离线能力，资源通过 Webpack/Terser/Compression 插件优化。
- 后端：本地用 Node.js/Express（`server.js`）模拟 Netlify Functions、代理 Simyo API；正式环境托管在 Netlify（静态+Functions），并提供 Cloudflare Turnstile、CSP、CORS 收敛。
- 目录：`src/` 含 giffgaff、simyo、js 模块（utilities、API service、middleware、performance）；`netlify/functions/` 为后端逻辑；`scripts/` 包含图像压缩、安全审计等 Node 工具；`docs/` 提供架构、指南、故障排查；`tests/` 含 Jest 配置与浏览器端测试页。
- 关键功能：自动 Cookie 登录、短信验证码激活、二维码生成、Simyo 设备更换支持、性能监控仪表盘、资源提示工具等。