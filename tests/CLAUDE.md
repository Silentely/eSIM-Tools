[根目录](../CLAUDE.md) > **tests**

# 测试模块

## 模块职责

提供单元测试，覆盖通用工具模块、Giffgaff/Simyo 业务模块和安全校验逻辑。

## 测试框架

- **框架**: Jest 30.3.0
- **环境**: jsdom (模拟浏览器)
- **配置**: `jest.config.js`
- **Mock**: `tests/__mocks__/` (styleMock.js, fileMock.js)
- **Setup**: `tests/setup.js`

## 测试文件

| 目录 | 文件 | 覆盖模块 | 测试项 |
|------|------|----------|--------|
| **modules/** | `app-config.test.js` | App Config | 环境配置管理 |
| | `logger.test.js` | Logger | 日志输出与脱敏 |
| | `utils.test.js` | Utils | 工具函数 (debounce/throttle 等) |
| | `html-sanitizer.test.js` | HTML Sanitizer | XSS 防护 (escapeHtml/escapeAttr) |
| | `secure-storage.test.js` | Secure Storage | 加密 localStorage (TTL 过期) |
| | `api-service.test.js` | API Service | HTTP 客户端 (重试/缓存/去重) |
| **simyo/** | `help.test.js` | Simyo 帮助文档 | 帮助内容渲染 |
| | `simyo-app-device-change.test.js` | `SimyoApp` | 设备更换流程 |
| | `device-change-handler.test.js` | 设备更换处理 | 设备更换逻辑 |
| **giffgaff/** | `direct-fetch.test.js` | Giffgaff 直接请求 | Fetch 调用逻辑 |
| **security/** | `bff-proxy.test.js` | BFF Proxy | Edge Function 安全校验 |
| | `functions-auth.test.js` | Functions Auth | withAuth 中间件鉴权 |
| | `server-routes.test.js` | Server Routes | 本地开发服务器路由 |

## 运行方式

```bash
npm test                 # 运行所有测试
npm run test:watch       # 监听模式
npm run test:coverage    # 生成覆盖率报告
```

## 覆盖率阈值

- Branches: 60%
- Functions: 60%
- Lines: 60%
- Statements: 60%

## Mock 说明

- `styleMock.js`: CSS 导入 mock (返回空对象)
- `fileMock.js`: 静态文件导入 mock (返回文件名字符串)
- `setup.js`: 全局 setup 文件，在每个测试前初始化 jsdom 环境

## 相关文件清单

- `jest.config.js` - Jest 配置
- `tests/setup.js` - 测试设置
- `tests/__mocks__/styleMock.js`
- `tests/__mocks__/fileMock.js`
- `tests/modules/app-config.test.js`
- `tests/modules/logger.test.js`
- `tests/modules/utils.test.js`
- `tests/modules/html-sanitizer.test.js`
- `tests/modules/secure-storage.test.js`
- `tests/modules/api-service.test.js`
- `tests/simyo/help.test.js`
- `tests/simyo/simyo-app-device-change.test.js`
- `tests/simyo/device-change-handler.test.js`
- `tests/giffgaff/direct-fetch.test.js`
- `tests/security/bff-proxy.test.js`
- `tests/security/functions-auth.test.js`
- `tests/security/server-routes.test.js`
