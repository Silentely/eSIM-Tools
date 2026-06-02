[根目录](../../CLAUDE.md) > [src](../) > **giffgaff**

# Giffgaff eSIM 前端模块

## 模块职责

实现 Giffgaff eSIM 管理的完整前端流程，包括 OAuth PKCE 认证、MFA 多因素验证、GraphQL API 交互和 eSIM 激活。采用浏览器原生 ES6 模块架构，不经 Webpack 打包，由 Netlify 静态托管直接派发。

## 入口与启动

- **HTML 入口**: `giffgaff_modular.html`
- **JS 入口**: `js/giffgaff-app.js` (应用主控制器)
- **加载方式**: `<script type="module">` 原生 ES6 模块加载

## 模块结构

```
src/giffgaff/
  giffgaff_modular.html          # 页面结构
  js/
    giffgaff-app.js              # 应用入口，初始化与事件协调
    modules/
      oauth-handler.js           # OAuth 2.0 PKCE 认证流程
      cookie-handler.js          # Cookie 验证与生命周期管理
      mfa-handler.js             # 多因素认证 (EMAIL/SMS)
      esim-service.js            # eSIM 业务操作 (预订/交换/LPA)
      ui-controller.js           # UI 状态管理与用户交互
      state-manager.js           # 集中状态管理 (观察者模式)
      api-config.js              # API 端点与 OAuth 配置
      utils.js                   # 通用工具函数 (PKCE/剪贴板/Toast)
  styles/
    giffgaff-base.css            # 基础样式
    giffgaff-components.css      # 组件样式
    giffgaff-service-time.css    # 服务时间样式
    giffgaff-animations.css      # 动画效果
    giffgaff-responsive.css      # 响应式布局
```

## 对外接口

### 核心业务流程

| 流程 | 入口方法 | 说明 |
|------|----------|------|
| **OAuth 登录** | `giffgaff-app.handleOAuthLogin()` | 启动 PKCE 认证，获取 access_token |
| **OAuth 回调** | `giffgaff-app.handleOAuthCallback()` | 处理授权回调，交换 token |
| **Cookie 验证** | `cookie-handler.verifyCookie()` | 验证 Cookie 有效性 (5 分钟轮询) |
| **MFA 发送** | `mfa-handler.sendMFAChallenge()` | 发送邮箱/短信验证码 |
| **MFA 验证** | `mfa-handler.validateMFACode()` | 验证验证码，获取签名 |
| **eSIM 预订** | `esim-service.reserveESim()` | 预订 eSIM，获取激活码和 SSN |
| **SIM 交换** | `esim-service.swapSim()` | 执行 SIM 交换，激活新 eSIM |
| **LPA 获取** | `esim-service.getESimDownloadToken()` | 轮询获取 LPA 字符串 |
| **SMS 激活** | `esim-service.smsActivateFlow()` | 端到端 SMS 激活完整流程 |

### 后端 API 调用

所有前端 API 请求通过 BFF 代理层 (`/bff/*`) 转发，经 Edge Function 注入 ACCESS_KEY 后到达 Netlify Functions。

| 前端调用 | 后端 Function | 说明 |
|----------|---------------|------|
| OAuth Token 交换 | `giffgaff-token-exchange` | code + PKCE verifier 换取 access_token |
| GraphQL 查询 | `giffgaff-graphql` | 会员信息、eSIM 状态等 |
| MFA 验证码 | `giffgaff-mfa-challenge` | 发送验证码 |
| MFA 验证 | `giffgaff-mfa-validation` | 验证验证码 |
| SMS 激活 | `giffgaff-sms-activate` | 端到端 SMS 激活 |
| Cookie 验证 | `verify-cookie` | 验证 Cookie 有效性 |

## 关键依赖与配置

### 前端依赖

- **无第三方框架依赖**，纯原生 JavaScript
- 依赖 `src/js/modules/` 下的通用工具模块 (logger、html-sanitizer、i18n 等)

### 配置文件

- `js/modules/api-config.js` -- OAuth client_id、redirect_uri、API 端点定义
- 环境变量 `GIFFGAFF_CLIENT_ID` 通过 `public-config` Function 下发

### 状态结构

```javascript
{
  accessToken: string,        // OAuth access_token
  codeVerifier: string,       // PKCE code_verifier
  cookie: string,             // Giffgaff Cookie
  emailCodeRef: string,       // 邮箱验证码 ref
  emailSignature: string,     // MFA 签名
  memberId: string,           // 会员 ID
  memberName: string,         // 会员名称
  phoneNumber: string,        // 手机号
  esimSSN: string,            // eSIM 序列号
  esimActivationCode: string, // eSIM 激活码
  esimDeliveryStatus: string, // eSIM 交付状态
  lpaString: string,          // LPA 字符串
  isDeviceChange: boolean,    // 是否设备更换
  currentStep: number         // 当前步骤
}
```

## 数据模型

### OAuth PKCE 流程

```
用户点击登录 -> 生成 code_verifier + code_challenge
  -> 打开授权页面 -> 用户授权 -> 获取回调 URL
  -> 解析 code + state -> 调用 token-exchange
  -> 保存 access_token
```

### eSIM 激活流程

```
发送短信验证码 -> 验证短信验证码 -> 获取签名
  -> 预订 eSIM -> 获取激活码和 SSN
  -> 执行 SIM 交换 -> 激活新 eSIM
  -> 轮询获取 LPA -> 生成二维码
```

## 测试与质量

- **测试文件**: `tests/giffgaff/direct-fetch.test.js`
- **覆盖范围**: Fetch 调用逻辑
- **测试框架**: Jest 30.3.0 + jsdom

## 常见问题

1. **OAuth 回调 URL 不匹配**: 确认 `api-config.js` 中 `oauthConfig.redirectUri` 与 Giffgaff 后台配置一致
2. **MFA 验证码未收到**: 检查 Cookie 是否有效，确认 `sendMFAChallenge` 的 ref 参数正确
3. **eSIM 激活失败**: 确认 access_token 未过期，检查 GraphQL 响应中的错误码
4. **Cookie 过期**: `cookie-handler.js` 每 5 分钟自动验证，过期后会清除状态并提示重新登录

## 相关文件清单

- `src/giffgaff/giffgaff_modular.html`
- `src/giffgaff/js/giffgaff-app.js`
- `src/giffgaff/js/modules/oauth-handler.js`
- `src/giffgaff/js/modules/cookie-handler.js`
- `src/giffgaff/js/modules/mfa-handler.js`
- `src/giffgaff/js/modules/esim-service.js`
- `src/giffgaff/js/modules/ui-controller.js`
- `src/giffgaff/js/modules/state-manager.js`
- `src/giffgaff/js/modules/api-config.js`
- `src/giffgaff/js/modules/utils.js`
- `src/giffgaff/styles/giffgaff-base.css`
- `src/giffgaff/styles/giffgaff-components.css`
- `src/giffgaff/styles/giffgaff-service-time.css`
- `src/giffgaff/styles/giffgaff-animations.css`
- `src/giffgaff/styles/giffgaff-responsive.css`
- `src/giffgaff/MODULE_ARCHITECTURE.md` -- 详细架构说明文档
