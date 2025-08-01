# 🚀 Netlify部署快速参考

## 📋 快速配置表

### 🔓 标准版本（开发/演示）

| 配置项 | 值 |
|--------|-----|
| **Build command** | `npm run build:standard` |
| **Publish directory** | `dist-standard` |
| **Functions directory** | `dist-standard/netlify/functions` |
| **Node version** | `18` |

**环境变量（可选）**:
```bash
NODE_ENV=production
BUILD_VERSION=standard
SECURITY_LEVEL=basic
```

### 🔒 安全版本（生产环境）

| 配置项 | 值 |
|--------|-----|
| **Build command** | `npm run build:secure` |
| **Publish directory** | `dist-secure` |
| **Functions directory** | `dist-secure/netlify/functions` |
| **Node version** | `18` |

**环境变量（必需）**:
```bash
NODE_ENV=production
BUILD_VERSION=secure
SECURITY_LEVEL=enterprise
SESSION_SECRET=your_32_character_secret_key_here
```

**环境变量（推荐）**:
```bash
GIFFGAFF_CLIENT_SECRET=your_giffgaff_client_secret
SIMYO_CLIENT_TOKEN=your_simyo_client_token
GIFFGAFF_CLIENT_ID=your_giffgaff_client_id
```

## 🔧 高级配置

### 使用配置文件

**标准版本**:
```bash
Build command: cp netlify-standard.toml netlify.toml && npm run build:standard
```

**安全版本**:
```bash
Build command: cp netlify-secure.toml netlify.toml && npm run build:secure
```

## ✅ 部署检查清单

### 部署前检查
- [ ] 仓库已Fork到个人账户
- [ ] 选择了正确的版本（标准/安全）
- [ ] 环境变量已配置（安全版本必需）
- [ ] Node.js版本设置为18

### 部署后验证
- [ ] 网站能正常访问
- [ ] 构建信息正确：`/build-info.json`
- [ ] 版本头部正确：`curl -I site.com | grep X-Build-Version`
- [ ] Giffgaff工具正常工作
- [ ] Simyo工具正常工作

## 🚨 常见错误解决

### 构建失败

**错误**: `Command failed with exit code 1`
**解决**: 检查构建命令是否正确，确保是 `npm run build:standard` 或 `npm run build:secure`

**错误**: `Module not found`
**解决**: 确保Node.js版本设置为18，检查package.json是否存在

### 安全版本特有错误

**错误**: `SESSION_SECRET is required`
**解决**: 在环境变量中添加至少32字符的 `SESSION_SECRET`

**错误**: `Functions deployment failed`
**解决**: 确保Functions目录设置为 `dist-secure/netlify/functions`

### 运行时错误

**错误**: 页面显示但功能不工作
**解决**: 检查浏览器控制台，可能是API端点配置问题

**错误**: CORS错误
**解决**: 确保使用了正确的netlify.toml配置文件

## 📞 支持资源

- **完整部署指南**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **安全实施文档**: [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md)
- **GitHub Issues**: [报告问题](https://github.com/Silentely/esim-tools/issues)

## 🎯 版本选择建议

| 场景 | 推荐版本 | 原因 |
|------|----------|------|
| 学习研究 | 标准版本 | 代码透明，易于理解 |
| 功能演示 | 标准版本 | 部署简单，无需配置 |
| 个人使用 | 安全版本 | 更好的隐私保护 |
| 企业部署 | 安全版本 | 企业级安全防护 |
| 商业项目 | 安全版本 | 防逆向，保护知识产权 |

---

**💡 提示**: 如果不确定选择哪个版本，建议先部署标准版本进行测试，确认功能正常后再部署安全版本用于生产环境。