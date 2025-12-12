# operations-log.md

日期：2025-12-12 23:54（UTC+8）
执行者：Codex

## 变更记录

- 2025-12-12 23:54（UTC+8）：调整通知去重策略为“仅页面生命周期内去重”，移除 localStorage 跨刷新持久化去重，使通知在每次页面加载（包含刷新）时都会显示一次。
  - 相关文件：`src/js/modules/notification-service.js`、`dist/src/js/modules/notification-service.js`
  - 使用工具：`rg`（检索通知实现）、`apply_patch`（修改代码）、`npm test`（回归测试，全部通过）

- 2025-12-12 23:58（UTC+8）：完善通知系统文档，补充“每次页面加载显示一次”的行为说明，修正 API 端点与响应示例，移除过时的 LocalStorage 描述。
  - 相关文件：`docs/guides/notification-system.md`
  - 使用工具：`apply_patch`
