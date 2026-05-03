[根目录](../../../CLAUDE.md) > [src/js/modules](../) > **giffgaff**

# Giffgaff 前端模块

## 模块职责

实现 Giffgaff eSIM 管理的完整前端流程，包括 OAuth 2.0 PKCE 登录、MFA 双通道验证、GraphQL API 交互、eSIM 预订与激活。

## 入口与启动

- **入口文件**: `src/js/giffgaff.js` (Webpack entry)
- **HTML 页面**: `src/giffgaff/giffgaff_modular.html` (通过 `src/js/giffgaff.js` 初始化)
- **启动流程**: `giffgaff.js` -> 导入样式和模块 -> `GiffgaffApp.init()` -> 绑定事件 -> 加载会话 -> 导航到目标步骤

## 对外接口

| 方法 | 说明 |
|------|------|
| `GiffgaffApp.init()` | 初始化应用 |
| `GiffgaffApp.handleOAuthLogin()` | 发起 OAuth 登录 |
| `GiffgaffApp.handleOAuthCallback()` | 处理 OAuth 回调 |
| `GiffgaffApp.handleCookieVerification()` | Cookie 验证登录 |
| `GiffgaffApp.handleSendEmail()` | 发送邮件验证码 |
| `GiffgaffApp.handleVerifyEmail()` | 验证邮件验证码 |
| `GiffgaffApp.handleReserveESIM()` | 预订 eSIM |
| `GiffgaffApp.handleGetESIMToken()` | 获取 eSIM 下载令牌 |
| `GiffgaffApp.handleClearSession()` | 清除会话 |

## 关键依赖与配置

- **状态管理**: `state.js` - AppState 类 (localStorage 持久化，2小时过期)
- **OAuth**: `oauth.js` - OAuthManager 类 (PKCE 流程，client_id 通过环境变量 `GIFFGAFF_CLIENT_ID` 配置)
- **API**: `api.js` - APIManager 类 (GraphQL 代理，MFA 验证)
- **工具**: `utils.js` - 工具函数 (服务时间检查、剪贴板、Toast)
- **DOM**: `dom.js` - DOM 操作封装
- **验证码**: 依赖 `../captcha-manager.js` (Turnstile/reCAPTCHA)

## 数据模型

```
AppState {
  codeVerifier: string       // PKCE Code Verifier
  oauthState: string         // OAuth State 参数
  accessToken: string        // Giffgaff Access Token
  emailCodeRef: string       // MFA 邮件验证码引用
  emailSignature: string     // MFA 验证签名
  memberId: string           // 会员 ID
  memberName: string         // 会员名称
  phoneNumber: string        // 手机号
  esimSSN: string            // eSIM SSN
  esimActivationCode: string // eSIM 激活码
  esimDeliveryStatus: string // eSIM 交付状态
  lpaString: string          // LPA 字符串 (最终结果)
  currentStep: number        // 当前步骤 (1-6)
  sessionTimestamp: number   // 会话时间戳
}
```

## 测试与质量

- **测试文件**: `tests/giffgaff/state.test.js`, `tests/giffgaff/oauth.test.js`, `tests/giffgaff/utils.test.js`
- **运行测试**: `npm test`
- **覆盖项**: 状态重置、会话保存/加载、过期处理、Code Verifier/Challenge 生成、URL 构建

## 常见问题

1. **OAuth 回调失败**: 检查 `GIFFGAFF_CLIENT_ID` 和 `GIFFGAFF_CLIENT_SECRET` 环境变量
2. **MFA 验证码发送失败**: 确认 Access Token 有效，检查 Giffgaff 服务时间窗口
3. **会话过期**: 默认 2 小时过期，可通过 `AppState.loadSession()` 检查

## 相关文件清单

- `src/js/giffgaff.js` - Webpack 入口
- `src/js/modules/giffgaff/app.js` - 主控制器
- `src/js/modules/giffgaff/state.js` - 状态管理
- `src/js/modules/giffgaff/oauth.js` - OAuth 流程
- `src/js/modules/giffgaff/api.js` - API 交互
- `src/js/modules/giffgaff/utils.js` - 工具函数
- `src/js/modules/giffgaff/dom.js` - DOM 操作
- `src/giffgaff/giffgaff_modular.html` - 页面模板
- `src/giffgaff/js/` - Legacy 模块 (保留兼容)
