[根目录](../../CLAUDE.md) > [netlify](../) > **edge-functions**

# Edge Functions 模块 (BFF Proxy)

## 模块职责

作为 Backend-For-Frontend 代理层，接收前端 `/bff/*` 请求，在服务端注入 ACCESS_KEY 并转发到显式白名单内的 `/.netlify/functions/*` 目标。

## 入口与启动

- **文件**: `netlify/edge-functions/bff-proxy.js`
- **运行时**: Deno (Edge-native)
- **部署**: Netlify Edge Network (全球边缘节点)
- **路由**: `netlify.toml` 中 `[[edge_functions]]` 配置 `path = "/bff/*"`

## 对外接口

### 请求流程
```
前端请求 /bff/{functionName}
  -> Edge Function (bff-proxy)
    -> 注入 x-esim-key 头 (ACCESS_KEY)
    -> 校验目标是否在白名单内
    -> 转发到 /.netlify/functions/{functionName}
    -> 透传响应
```

## 关键依赖与配置

- **环境变量**: `ACCESS_KEY`, `ALLOWED_ORIGIN`

## 测试与质量

- **无独立测试** (Edge Functions 在 Netlify Edge Runtime 运行)
- **本地调试**: 使用 `netlify dev` 启动完整模拟环境

## 常见问题

1. **ACCESS_KEY 未配置**: 返回 500 Server Misconfigured
2. **ALLOWED_ORIGIN 未配置或不匹配**: 返回 403 Forbidden
3. **CORS 问题**: Edge Function 会补充 CORS 头，但最终函数侧仍会再次执行来源校验

## 相关文件清单

- `netlify/edge-functions/bff-proxy.js` - BFF 代理实现
- `netlify.toml` - Edge Functions 路由配置
