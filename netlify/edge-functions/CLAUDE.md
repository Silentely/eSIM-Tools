[根目录](../../CLAUDE.md) > [netlify](../) > **edge-functions**

# Edge Functions 模块

## 模块职责

1. **BFF Proxy (`bff-proxy.js`)**：作为 Backend-For-Frontend 代理层，接收前端 `/bff/*` 请求，在服务端注入 ACCESS_KEY 并转发到显式白名单内的 `/.netlify/functions/*` 目标。
2. **Sentry Tunnel (`sentry-tunnel.js`)**：作为 Sentry 监控上报隧道，接收前端 `/api/sentry-tunnel` 请求，校验目标 DSN 白名单后转发至 Sentry 官方 Ingest 接口，规避客户端广告拦截器（如 uBlock Origin）对监控上报的阻断。
3. **Markdown Negotiation (`markdown-negotiation.js`)**：检测 `Accept: text/markdown` 请求，提供面向 Agent 的 Markdown 内容协商。

## 入口与启动

- **文件**:
  - `netlify/edge-functions/bff-proxy.js`
  - `netlify/edge-functions/sentry-tunnel.js`
  - `netlify/edge-functions/markdown-negotiation.js`
- **运行时**: Deno (Edge-native)
- **部署**: Netlify Edge Network (全球边缘节点)
- **路由**: `netlify.toml` 中 `[[edge_functions]]` 配置

## 关键依赖与配置

- **环境变量**:
  - `ACCESS_KEY`, `ALLOWED_ORIGIN` (BFF Proxy)
  - `SENTRY_DSN` (Sentry Tunnel 可选白名单动态解析)

## 测试与质量

- **本地调试**: 使用 `netlify dev` 启动完整模拟环境

## 相关文件清单

- `netlify/edge-functions/bff-proxy.js` - BFF 代理实现
- `netlify/edge-functions/sentry-tunnel.js` - Sentry 上报隧道代理
- `netlify/edge-functions/markdown-negotiation.js` - Markdown 内容协商
- `netlify.toml` - Edge Functions 路由配置
