[根目录](../../../CLAUDE.md) > [src/js/modules](../) > **simyo**

# Simyo 前端模块

## 模块职责

实现 Simyo eSIM 管理的完整前端流程，包括用户登录、短信验证码验证、设备更换和 eSIM 激活。

## 入口与启动

- **入口文件**: `src/js/simyo.js` (Webpack entry)
- **HTML 页面**: `src/simyo/simyo_modular.html` (通过 `src/js/simyo.js` 初始化)
- **启动流程**: `simyo.js` -> 导入样式和模块 -> `SimyoApp.init()` -> 绑定事件 -> 加载会话

## 对外接口

| 方法 | 说明 |
|------|------|
| `SimyoApp.init()` | 初始化应用 |
| `SimyoApp.handleLogin()` | 用户登录 (用户名/密码) |
| `SimyoApp.handleSendSMS()` | 发送短信验证码 |
| `SimyoApp.handleVerifySMS()` | 验证短信验证码 |
| `SimyoApp.handleDeviceChange()` | 设备更换 |
| `SimyoApp.handleConfirmInstall()` | 确认 eSIM 安装 |

## 关键依赖与配置

- **API**: `api.js` - SimyoAPIManager 类 (登录、短信验证、设备更换、eSIM 激活)
- **安全存储**: 依赖 `../secure-storage.js` (加密 localStorage)
- **HTML 消毒**: 依赖 `../html-sanitizer.js` (XSS 防护)
- **API 代理**: 通过 Netlify Redirects 代理到 `https://appapi.simyo.nl`

## 数据模型

```
SimyoState {
  token: string           // 访问令牌
  username: string        // 用户名
  phoneNumber: string     // 手机号
  esimData: object        // eSIM 数据 (lpaString 等)
  currentStep: number     // 当前步骤 (1-4)
}
```

## 测试与质量

- **测试文件**: `tests/simyo/help.test.js`, `tests/simyo/simyo-app-device-change.test.js`, `tests/simyo/device-change-handler.test.js`
- **运行测试**: `npm test`
- **覆盖项**: 设备更换流程、帮助文档、应用初始化

## 常见问题

1. **登录失败**: 检查用户名格式 (荷兰手机号: 06 开头 10 位数字)
2. **API 代理失败**: 确认 Netlify Redirects 配置正确
3. **会话过期**: 默认 1 小时 TTL (SecureStorage)

## 相关文件清单

- `src/js/simyo.js` - Webpack 入口
- `src/js/modules/simyo/app.js` - 主控制器
- `src/js/modules/simyo/api.js` - API 交互
- `src/simyo/simyo_modular.html` - 页面模板
- `src/simyo/js/` - Legacy 模块 (保留兼容)
