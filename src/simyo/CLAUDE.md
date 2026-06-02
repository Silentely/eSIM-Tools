[根目录](../../CLAUDE.md) > [src](../) > **simyo**

# Simyo eSIM 前端模块

## 模块职责

实现 Simyo eSIM 管理的完整前端流程，包括账户登录认证、设备更换和 eSIM 激活。采用浏览器原生 ES6 模块架构，不经 Webpack 打包，由 Netlify 静态托管直接派发。

## 入口与启动

- **HTML 入口**: `simyo_modular.html`
- **JS 入口**: `js/simyo-app.js` (应用主控制器)
- **加载方式**: `<script type="module">` 原生 ES6 模块加载

## 模块结构

```
src/simyo/
  simyo_modular.html            # 页面结构
  simyo_proxy_server.js         # 本地代理服务器 (开发用)
  js/
    simyo-app.js                # 应用入口，初始化与事件协调
    modules/
      auth-handler.js           # 账户登录认证
      device-change-handler.js  # 设备更换流程
      esim-service.js           # eSIM 业务操作 (获取/确认/LPA)
      ui-controller.js          # UI 状态管理与用户交互
      state-manager.js          # 集中状态管理 (观察者模式)
      api-config.js             # API 端点与请求头配置
      utils.js                  # 通用工具函数 (手机号验证/剪贴板/Toast)
  styles/
    simyo-base.css              # 基础样式
    simyo-components.css        # 组件样式
    simyo-animations.css        # 动画效果
    simyo-responsive.css        # 响应式布局
```

## 对外接口

### 核心业务流程

| 流程 | 入口方法 | 说明 |
|------|----------|------|
| **账户登录** | `simyo-app.handleLogin()` | 手机号 + 密码登录，获取 sessionToken |
| **设备更换** | `simyo-app.handleDeviceChange()` | 请求设备更换，验证邮箱验证码 |
| **获取 eSIM** | `simyo-app.handleGetEsim()` | 获取 eSIM 信息，生成 LPA 二维码 |
| **确认安装** | `esim-service.confirmInstall()` | 确认 eSIM 安装完成 |

### 后端 API 调用

Simyo 模块直接调用 Simyo 官方 API，不经过 Netlify Functions BFF 代理层。

| 前端调用 | API 端点 | 说明 |
|----------|----------|------|
| 登录 | Simyo 登录 API | 手机号 + 密码认证 |
| 设备更换请求 | Simyo 设备更换 API | 触发邮箱验证码 |
| 验证码验证 | Simyo 验证 API | 验证邮箱验证码 |
| 获取 eSIM | Simyo eSIM API | 获取激活码和 LPA |

## 关键依赖与配置

### 前端依赖

- **无第三方框架依赖**，纯原生 JavaScript
- 依赖 `src/js/modules/` 下的通用工具模块 (logger、html-sanitizer、i18n 等)

### 配置文件

- `js/modules/api-config.js` -- Simyo API 端点、请求头配置
- `simyo_proxy_server.js` -- 本地开发代理服务器 (解决 CORS)

### 状态结构

```javascript
{
  sessionToken: string,    // 登录会话 token
  phoneNumber: string,     // 手机号
  password: string,        // 密码 (仅登录时使用)
  activationCode: string,  // eSIM 激活码
  validationCode: string,  // 邮箱验证码
  isDeviceChange: boolean, // 是否设备更换
  currentStep: number,     // 当前步骤
  timestamp: number        // 时间戳
}
```

## 数据模型

### 登录流程

```
用户输入手机号 + 密码 -> 验证手机号格式
  -> 调用登录 API -> 保存 sessionToken
  -> 显示设备更换选项
```

### 设备更换流程

```
请求设备更换 -> 系统发送邮箱验证码
  -> 用户输入验证码 -> 验证并更新状态
  -> 显示下一步操作
```

### eSIM 获取流程

```
调用获取 eSIM API -> 解析激活码
  -> 保存到状态 -> 生成 LPA 字符串
  -> 生成二维码
```

## 与 Giffgaff 模块的差异

| 维度 | Giffgaff | Simyo |
|------|----------|-------|
| **认证方式** | OAuth PKCE | 手机号 + 密码 |
| **API 代理** | 通过 BFF 代理层 | 直接调用 |
| **MFA** | 邮箱/短信验证码 | 邮箱验证码 |
| **设备更换** | 无独立流程 | 有独立设备更换流程 |
| **后端依赖** | 11 个 Netlify Functions | 无 (直接调用 Simyo API) |

## 测试与质量

- **测试文件**:
  - `tests/simyo/help.test.js` -- 帮助文档渲染
  - `tests/simyo/simyo-app-device-change.test.js` -- 设备更换流程
  - `tests/simyo/device-change-handler.test.js` -- 设备更换逻辑
- **测试框架**: Jest 30.3.0 + jsdom

## 常见问题

1. **登录失败**: 检查手机号格式是否正确，确认 Simyo API 端点可用
2. **设备更换验证码未收到**: 检查邮箱是否正确，确认 Simyo 服务状态
3. **eSIM 激活码无效**: 确认 sessionToken 未过期，检查 API 响应
4. **CORS 错误**: 开发环境使用 `simyo_proxy_server.js` 代理，生产环境由 Netlify Edge Functions 处理

## 相关文件清单

- `src/simyo/simyo_modular.html`
- `src/simyo/simyo_proxy_server.js`
- `src/simyo/js/simyo-app.js`
- `src/simyo/js/modules/auth-handler.js`
- `src/simyo/js/modules/device-change-handler.js`
- `src/simyo/js/modules/esim-service.js`
- `src/simyo/js/modules/ui-controller.js`
- `src/simyo/js/modules/state-manager.js`
- `src/simyo/js/modules/api-config.js`
- `src/simyo/js/modules/utils.js`
- `src/simyo/styles/simyo-base.css`
- `src/simyo/styles/simyo-components.css`
- `src/simyo/styles/simyo-animations.css`
- `src/simyo/styles/simyo-responsive.css`
- `src/simyo/MODULE_ARCHITECTURE.md` -- 详细架构说明文档
