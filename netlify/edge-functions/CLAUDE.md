[根目录](../../CLAUDE.md) > [netlify](../) > **edge-functions**

# Edge Functions 模块 (BFF Proxy)

## 模块职责

作为 Backend-For-Frontend 代理层，接收前端 `/bff/*` 请求，在服务端注入 ACCESS_KEY 并验证 Turnstile/reCAPTCHA 验证码，然后转发到对应的 `/.netlify/functions/*` 目标。

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
    -> 验证 Turnstile/reCAPTCHA Token (写操作必须)
    -> 注入 x-esim-key 头 (ACCESS_KEY)
    -> 转发到 /.netlify/functions/{functionName}
    -> 透传响应
```

### 验证码校验规则
- **必须校验的函数**: `giffgaff-token-exchange`, `giffgaff-mfa-*`, `giffgaff-graphql`, `verify-cookie`, `auto-activate-esim`, `giffgaff-sms-activate`
- **无需校验的函数**: `health`, `public-config`, `giffgaff-mfa-challenge` (仅发送)
- **Token 来源**: 请求头 `X-Human-Captcha` / `X-CF-Turnstile` 或请求体 `captchaToken` / `turnstileToken`

## 关键依赖与配置

- **环境变量**: `ACCESS_KEY`, `CAPTCHA_PROVIDER`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ENFORCE`, `RECAPTCHA_SECRET_KEY`
- **外部 API**: `https://challenges.cloudflare.com/turnstile/v0/siteverify` (Turnstile 校验)
- **外部 API**: `https://www.google.com/recaptcha/api/siteverify` (reCAPTCHA 校验)

## 测试与质量

- **无独立测试** (Edge Functions 在 Netlify Edge Runtime 运行)
- **本地调试**: 使用 `netlify dev` 启动完整模拟环境

## 常见问题

1. **ACCESS_KEY 未配置**: 返回 500 Server Misconfigured
2. **验证码校验失败**: 返回 403 Captcha Failed
3. **CORS 问题**: Edge Function 不设置 CORS 头，由 Functions 中间件处理

## 相关文件清单

- `netlify/edge-functions/bff-proxy.js` - BFF 代理实现
- `netlify.toml` - Edge Functions 路由配置
