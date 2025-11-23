# 任务完成检查单
1. 本地跑通 `npm test`（或至少相关模块的 Jest 套件），并根据修改范围补充端到端 HTML 测试页或手动流程。
2. 若涉及前端逻辑或样式，执行 `npm run build` 确认 PostCSS/webpack 成功，必要时运行 `npm run build:css` / `npm run build:js` 独立定位错误。
3. 有网络/API 交互改动时，用 `npm start` 或 `npm run netlify-dev` 回归关键 eSIM 流程（Giffgaff OAuth+短信、Simyo 登录+设备更换），观察控制台和 Network。
4. 涉及静态资源或脚本体积变化时，运行 `npm run optimize-images` / `npm run compress` 并检查 `dist/` 输出及 `sw.js` 预缓存列表。
5. 进行 `npm run security-check` 确保 CSP/依赖未被破坏，确认 `.env` 示例与文档同步，必要时更新 `docs/` 指南。
6. 提交前更新相关文档（README/docs）与配置（如 `netlify.toml`, `manifest.webmanifest`），并记录变更影响。