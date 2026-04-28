[根目录](../CLAUDE.md) > **tests**

# 测试模块

## 模块职责

提供单元测试，覆盖 Giffgaff 和 Simyo 前端模块的核心逻辑。

## 测试框架

- **框架**: Jest 29.7.0
- **环境**: jsdom (模拟浏览器)
- **配置**: `jest.config.js`
- **Mock**: `tests/__mocks__/` (styleMock.js, fileMock.js)
- **Setup**: `tests/setup.js`

## 测试文件

| 文件 | 覆盖模块 | 测试项 |
|------|----------|--------|
| `giffgaff/state.test.js` | `AppState` | reset(), saveSession(), loadSession(), getTargetStep(), clearSession() |
| `giffgaff/oauth.test.js` | `OAuthManager` | Code Verifier/Challenge 生成, URL 构建, Token 交换 |
| `giffgaff/utils.test.js` | Giffgaff 工具函数 | Cookie 操作, 服务时间检查, 剪贴板, QR 码生成 |
| `simyo/help.test.js` | Simyo 帮助文档 | 帮助内容渲染 |
| `simyo/simyo-app-device-change.test.js` | `SimyoApp` | 设备更换流程 |
| `simyo/device-change-handler.test.js` | 设备更换处理 | 设备更换逻辑 |

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

## 相关文件清单

- `jest.config.js` - Jest 配置
- `tests/setup.js` - 测试设置
- `tests/__mocks__/styleMock.js`
- `tests/__mocks__/fileMock.js`
- `tests/giffgaff/state.test.js`
- `tests/giffgaff/oauth.test.js`
- `tests/giffgaff/utils.test.js`
- `tests/simyo/help.test.js`
- `tests/simyo/simyo-app-device-change.test.js`
- `tests/simyo/device-change-handler.test.js`
