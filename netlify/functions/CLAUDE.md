[根目录](../../CLAUDE.md) > [netlify](../) > **functions**

# Netlify Functions 模块

## 模块职责

提供 Serverless 后端逻辑，处理 Giffgaff OAuth/MFA/GraphQL 交互、Cookie 验证、eSIM 激活等核心业务。所有函数通过统一中间件 `withAuth` 包装。

## 入口与启动

- **部署目录**: `netlify/functions/`
- **本地模拟**: `server.js` 通过 `wrapNetlifyFunction()` 将 Functions 包装为 Express 路由
- **中间件**: `_shared/middleware.js` - 统一鉴权/CORS/验证/错误处理

## 函数列表

| 函数 | 文件 | 方法 | 认证 | 职责 |
|------|------|------|------|------|
| **giffgaff-token-exchange** | `giffgaff-token-exchange.js` | POST | 是 | OAuth Token 交换 (client_secret 仅服务端) |
| **giffgaff-graphql** | `giffgaff-graphql.js` | POST | 是 | GraphQL API 代理 (自动 Token 刷新) |
| **giffgaff-mfa-challenge** | `giffgaff-mfa-challenge.js` | POST | 是 | MFA 验证码发送 (EMAIL/SMS 双通道) |
| **giffgaff-mfa-validation** | `giffgaff-mfa-validation.js` | POST | 是 | MFA 验证码验证 |
| **giffgaff-sms-activate** | `giffgaff-sms-activate.js` | POST | 是 | SMS 激活端到端流程 |
| **auto-activate-esim** | `auto-activate-esim.js` | POST | 是 | 网页激活 (浏览器流程模拟) |
| **verify-cookie** | `verify-cookie.js` | POST | 是 | Cookie 验证与 Token 提取 |
| **health** | `health.js` | GET/POST | 否 | 健康检查 (环境变量检测) |
| **public-config** | `public-config.js` | GET | 否 | 公共配置下发 (验证码配置) |
| **notifications** | `notifications.js` | GET | 否 | 通知 API (公开接口，`requireAuth: false`) |
| **notifications-internal** | `notifications-internal.js` | GET | 否 | 内部通知 API |

## 对外接口

### withAuth 中间件
```javascript
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');

exports.handler = withAuth(async (event, context, { auth, body }) => {
  // auth: { authorized, origin, preflight }
  // body: 已解析的请求体 (JSON)
  // 验证失败自动抛出 AuthError
}, { validateSchema: mySchema, requireAuth: true });
```

### 验证 Schema
```javascript
const schema = {
  field: { required: true, type: 'string', minLength: 10, pattern: /^\d+$/, enum: ['a', 'b'] }
};
```

## 关键依赖与配置

- **axios**: HTTP 请求 (Functions 内部调用外部 API)
- **cheerio**: HTML 解析 (爬虫场景)
- **@sentry/node**: 错误监控 (生产环境)
- **环境变量**: `ACCESS_KEY`, `GIFFGAFF_CLIENT_ID`, `GIFFGAFF_CLIENT_SECRET`, `SENTRY_DSN`

## 数据模型

### GraphQL 请求体
```javascript
{
  accessToken: string,
  cookie: string,          // 可选，用于 Token 刷新
  mfaSignature: string,    // 可选，MFA 签名
  query: string,           // GraphQL 查询
  variables: object,       // GraphQL 变量
  operationName: string    // 操作名
}
```

### Token 交换请求体
```javascript
{
  code: string,            // 授权码
  code_verifier: string,   // PKCE Verifier
  redirect_uri: string,    // 回调 URL
  turnstileToken: string   // 验证码 Token
}
```

## 测试与质量

- **无独立 Functions 单元测试** (当前仅通过前端测试间接覆盖)
- **健康检查**: `/.netlify/functions/health` 验证环境变量配置
- **输入验证**: 所有函数通过 Schema 验证请求参数
- **错误处理**: 统一错误格式 + Sentry 上报 (5xx)

## 常见问题

1. **ACCESS_KEY 未配置**: 检查 Netlify 环境变量
2. **Token 交换失败**: 确认 `GIFFGAFF_CLIENT_SECRET` 格式正确 (Base64, >=32 字符)
3. **GraphQL 401 错误**: 会自动尝试 Cookie 刷新 Token

## 相关文件清单

- `netlify/functions/_shared/middleware.js` - 统一中间件
- `netlify/functions/_shared/sentry.js` - Sentry 模块
- `netlify/functions/_shared/rate-limiter.js` - 限流器
- `netlify/functions/giffgaff-token-exchange.js`
- `netlify/functions/giffgaff-graphql.js`
- `netlify/functions/giffgaff-mfa-challenge.js`
- `netlify/functions/giffgaff-mfa-validation.js`
- `netlify/functions/giffgaff-sms-activate.js`
- `netlify/functions/auto-activate-esim.js`
- `netlify/functions/verify-cookie.js`
- `netlify/functions/health.js`
- `netlify/functions/public-config.js`
- `netlify/functions/notifications.js`
- `netlify/functions/notifications-internal.js`
