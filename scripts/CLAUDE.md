[根目录](../CLAUDE.md) > **scripts**

# 构建脚本模块

## 模块职责

提供构建、质量检查、安全扫描和自动化部署脚本。

## 脚本列表

### 构建相关

| 脚本 | 命令 | 职责 |
|------|------|------|
| `build-static.js` | `npm run build` | Webpack 打包与资源优化 |
| `verify-legacy-frozen.js` | `npm run verify:legacy` | 验证 legacy 文件未被修改 |
| `transpile-dist-js.js` | - | dist/ JS 文件转译 |
| `inject-sentry-config.js` | - | Sentry 配置注入 |

### 质量检查

| 脚本 | 命令 | 职责 |
|------|------|------|
| `quality-check.js` | `npm run quality-check` | 代码质量检查 (14 项) |
| `security-check.js` | `npm run security-check` | 安全配置扫描 |

### 部署相关

| 脚本 | 命令 | 职责 |
|------|------|------|
| `deploy-prepare.js` | `npm run deploy-prepare` | 部署准备 (质量+安全+构建) |
| `deploy-analyze.js` | `npm run deploy-analyze` | 部署分析 |
| `test-deploy-config.js` | `npm run deploy-test` | Netlify 配置验证 |
| `deploy.sh` | - | 部署 Shell 脚本 |

### 资源优化

| 脚本 | 命令 | 职责 |
|------|------|------|
| `optimize-images.js` | `npm run optimize-images` | Sharp 图片压缩 |
| `compress.js` | `npm run compress` | Gzip/Brotli 压缩 |

### Git Hooks

| 脚本 | 命令 | 职责 |
|------|------|------|
| `pre-commit-check.js` | `npm run precommit:check` | Pre-commit 检查 |
| `pre-push-check.js` | `npm run prepush:check` | Pre-push 检查 (full/fast 模式) |
| `commit-msg-lint.js` | `npm run commitmsg:lint` | Commit message 规范检查 |
| `prepare-commit-msg.js` | - | Commit message 自动生成 |

### 工具

| 脚本 | 职责 |
|------|------|
| `logger.js` | 构建日志模块 (彩色输出) |
| `replace-console-log.js` | 替换 console.log |
| `update-script-logging.js` | 更新脚本日志 |
| `apply-middleware.sh` | 应用中间件 |
| `start_simyo_server.sh/.bat` | 启动 Simyo 代理服务器 |

## 运行方式

```bash
npm run build              # 构建
npm run quality-check      # 质量检查
npm run security-check     # 安全扫描
npm run deploy-prepare     # 部署准备
npm run optimize-images    # 图片优化
npm run compress           # 资源压缩
```

## 相关文件清单

- `scripts/build-static.js`
- `scripts/quality-check.js`
- `scripts/security-check.js`
- `scripts/deploy-prepare.js`
- `scripts/test-deploy-config.js`
- `scripts/optimize-images.js`
- `scripts/compress.js`
- `scripts/logger.js`
- `scripts/pre-commit-check.js`
- `scripts/pre-push-check.js`
- `scripts/commit-msg-lint.js`
