# 🔒 eSIM工具集 - 企业级安全版本

[![Netlify Status](https://api.netlify.com/api/v1/badges/8fc159e2-3996-4e1b-bf9d-1945a3474682/deploy-status)](https://app.netlify.com/projects/esim-tools/deploys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security](https://img.shields.io/badge/Security-Enterprise-red.svg)](https://github.com/Silentely/esim-tools/blob/main/docs/SECURITY_IMPLEMENTATION.md)

🛡️ **企业级安全保护的eSIM管理工具集** - 采用多层安全防护技术，确保您的数据绝对安全。专为Giffgaff和Simyo用户设计，支持完整的eSIM申请、设备更换和二维码生成流程。

## ✨ 功能特性

### 🔧 Giffgaff eSIM工具（企业级安全版本）
- 🛡️ **企业级安全保护** - 多层防护机制，防止逆向工程
- 🔐 **加密OAuth认证** - 所有敏感操作后端处理
- 📧 **安全MFA验证** - 邮件验证码，无前端敏感信息暴露
- 🚀 **高性能API调用** - 通过安全代理处理所有请求
- 🎯 **智能二维码生成** - 服务端生成，确保数据安全
- 🔒 **防调试保护** - 阻止开发者工具和代码查看
- 🚫 **防爬虫机制** - 智能检测和阻止自动化工具

### 📱 Simyo eSIM工具
- **简单登录验证** - 手机号+密码认证
- **设备更换流程** - 支持验证码处理
- **短信验证码** - 自动发送和验证
- **一键二维码生成** - 即时生成可扫描二维码
- **安装确认功能** - 确保eSIM正确激活

## 🌐 在线使用

### 🚀 公共服务（推荐）
- **安全版本**: [https://esim.cosr.eu.org](https://esim.cosr.eu.org) 🔒
  - 企业级安全保护
  - 防逆向工程
  - 生产环境推荐
- **标准版本**: [https://esim-standard.cosr.eu.org](https://esim-standard.cosr.eu.org) 🔓
  - 开源透明
  - 开发学习友好
  - 功能演示

### 📱 快速访问
- **Giffgaff工具**: 
  - 安全版本: [esim.cosr.eu.org/giffgaff](https://esim.cosr.eu.org/giffgaff) 🔒
  - 标准版本: [esim-standard.cosr.eu.org/giffgaff](https://esim-standard.cosr.eu.org/giffgaff) 🔓
- **Simyo工具**: 
  - 安全版本: [esim.cosr.eu.org/simyo](https://esim.cosr.eu.org/simyo) 🔒
  - 标准版本: [esim-standard.cosr.eu.org/simyo](https://esim-standard.cosr.eu.org/simyo) 🔓

### 💰 优惠信息
新用户开卡可享受**额外5欧元话费赠送**！[立即开卡](https://vriendendeal.simyo.nl/prepaid/AZzwPzb)

## 🌐 Netlify手动部署指南

### 📋 部署前准备

1. **Fork此仓库** 到您的GitHub账户
2. **登录Netlify** 并连接GitHub账户
3. **选择部署版本** - 根据需求选择标准版本或安全版本

### 🔧 Netlify部署配置

#### 🔓 标准版本部署

**适用场景**: 开发学习、功能演示、开源项目

| 配置项 | 值 |
|--------|-----|
| **Build command** | `npm run build:standard` |
| **Publish directory** | `dist-standard` |
| **Functions directory** | `dist-standard/netlify/functions` |

**详细步骤**:
1. 在Netlify中点击 "New site from Git"
2. 选择您Fork的仓库
3. 配置构建设置：
   ```
   Build command: npm run build:standard
   Publish directory: dist-standard
   ```
4. 点击 "Deploy site"

#### 🔒 安全版本部署

**适用场景**: 生产环境、企业使用、商业项目

| 配置项 | 值 |
|--------|-----|
| **Build command** | `npm run build:secure` |
| **Publish directory** | `dist-secure` |
| **Functions directory** | `dist-secure/netlify/functions` |

**详细步骤**:
1. 在Netlify中点击 "New site from Git"
2. 选择您Fork的仓库
3. 配置构建设置：
   ```
   Build command: npm run build:secure
   Publish directory: dist-secure
   ```
4. **重要**: 配置环境变量（安全版本必需）：
   - `GIFFGAFF_CLIENT_SECRET`: 您的Giffgaff客户端密钥
   - `SIMYO_CLIENT_TOKEN`: 您的Simyo客户端令牌
   - `SESSION_SECRET`: 会话加密密钥（至少32字符）
5. 点击 "Deploy site"

### ⚙️ 高级配置选项

#### 使用配置文件部署

如果您想使用预设的配置文件：

**标准版本**:
```
Build command: cp netlify-standard.toml netlify.toml && npm run build:standard
Publish directory: dist-standard
```

**安全版本**:
```
Build command: cp netlify-secure.toml netlify.toml && npm run build:secure
Publish directory: dist-secure
```

#### 环境变量配置

在Netlify控制台的 "Site settings" → "Environment variables" 中添加：

**标准版本环境变量**:
```
NODE_ENV=production
BUILD_VERSION=standard
SECURITY_LEVEL=basic
```

**安全版本环境变量**:
```
NODE_ENV=production
BUILD_VERSION=secure
SECURITY_LEVEL=enterprise
GIFFGAFF_CLIENT_SECRET=your_secret_here
SIMYO_CLIENT_TOKEN=your_token_here
SESSION_SECRET=your_32_char_secret_here
```

### 🚀 部署验证

部署完成后，您可以通过以下方式验证：

#### 检查版本信息
```bash
# 检查HTTP头部
curl -I https://your-site.netlify.app | grep X-Build-Version

# 标准版本返回: X-Build-Version: standard
# 安全版本返回: X-Build-Version: secure
```

#### 检查构建信息
访问 `https://your-site.netlify.app/build-info.json` 查看详细构建信息

### 🔄 更新部署

当您更新代码后：

1. **推送到GitHub** - Netlify会自动检测更改
2. **自动重新构建** - 使用相同的构建配置
3. **部署完成** - 新版本自动上线

### ❓ 常见问题

#### Q: 构建失败怎么办？
A: 检查Netlify的构建日志，通常是环境变量配置问题

#### Q: 安全版本需要哪些环境变量？
A: 至少需要 `SESSION_SECRET`，建议配置完整的密钥信息

#### Q: 可以同时部署两个版本吗？
A: 可以！创建两个不同的Netlify站点，分别使用不同的构建配置

#### Q: 如何切换版本？
A: 修改构建命令和发布目录，然后重新部署

### 📋 快速参考

- **[Netlify部署快速参考](docs/NETLIFY_QUICK_REFERENCE.md)** - 配置表和常见问题
- **[完整部署指南](docs/DEPLOYMENT_GUIDE.md)** - 详细的部署说明
- **[安全实施方案](docs/SECURITY_IMPLEMENTATION.md)** - 安全版本技术细节

## 🔒 企业级安全特性

### 🛡️ 多层安全防护
- **零敏感信息暴露** - 所有OAuth密钥、API令牌完全后端处理
- **业务逻辑保护** - 重要操作流程完全封装，前端无法逆向
- **代码混淆保护** - 变量名、函数名高度混淆，难以理解
- **防调试机制** - 检测并阻止开发者工具、控制台调试
- **防爬虫保护** - 智能检测Selenium、Puppeteer等自动化工具

### 🔐 数据传输安全
- **端到端加密** - 所有敏感数据传输前加密
- **请求签名验证** - 防止请求伪造和重放攻击
- **会话管理** - 安全的会话令牌管理，自动过期机制
- **HTTPS强制** - 强制HTTPS传输，HSTS头部保护

### 🚫 访问控制
- **速率限制** - 防止暴力破解和DOS攻击
- **IP白名单** - 可选的IP访问控制
- **用户代理检测** - 阻止已知的恶意爬虫和工具
- **异常行为检测** - 智能识别异常操作模式

### 📊 安全监控
- **实时日志** - 详细的安全事件日志记录
- **告警机制** - 异常访问自动告警
- **审计追踪** - 完整的操作审计链
- **性能监控** - 确保安全措施不影响用户体验

> 📋 **详细安全文档**: [查看完整安全实施方案](docs/SECURITY_IMPLEMENTATION.md)

## 🚀 双版本部署指南

本项目提供两个独立版本，您可以根据需求选择部署：

### 📋 版本选择

| 版本 | 适用场景 | 特点 |
|------|----------|------|
| **标准版本** | 开发学习、功能演示 | 🔓 代码开源、功能完整、易于理解 |
| **安全版本** | 生产环境、企业使用 | 🔒 企业级安全、防逆向、零信息暴露 |

### 🔧 快速部署

#### 标准版本部署
```bash
# 克隆仓库
git clone https://github.com/Silentely/esim-tools.git
cd esim-tools

# 安装依赖
npm install

# 构建标准版本
npm run build:standard

# 部署到Netlify
npm run deploy:standard
```

#### 安全版本部署
```bash
# 克隆仓库（同上）
git clone https://github.com/Silentely/esim-tools.git
cd esim-tools

# 配置环境变量
cp env.example .env
# 编辑 .env 文件，填入真实的密钥和配置

# 安装依赖
npm install

# 构建安全版本
npm run build:secure

# 部署到Netlify
npm run deploy:secure
```

### 🔧 高级部署选项

#### 使用不同的Netlify配置
```bash
# 标准版本配置
netlify deploy --prod --config netlify-standard.toml

# 安全版本配置
netlify deploy --prod --config netlify-secure.toml
```

#### 预览部署
```bash
# 预览标准版本
npm run preview:standard

# 预览安全版本
npm run preview:secure
```

#### 开发环境设置
```bash
# 启动本地服务器
npm run dev

# 访问应用
http://localhost:3000

# 测试构建
npm run build:standard  # 或 npm run build:secure
```

> 📖 **详细部署文档**: [查看完整部署指南](docs/DEPLOYMENT_GUIDE.md)

### 环境要求

#### 生产环境
- **无特殊要求** - 纯静态部署 + Netlify Functions
- **现代浏览器** - Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

#### 开发环境
- **Node.js** >= 18.0.0 (仅本地开发需要)
- **npm** >= 8.0.0 (仅本地开发需要)

### 技术架构
- **前端**: 纯HTML/CSS/JavaScript，无框架依赖，会话持久化
- **后端**: Netlify Functions（生产）+ Node.js Express（开发）
- **部署**: 完全无服务器架构
- **API代理**: 统一CORS处理，完整日志记录
- **安全**: Helmet.js安全头，CORS配置

## 📦 Netlify部署

### 自动部署
```bash
./deploy.sh
```

### 手动部署
1. Fork此仓库
2. 在[Netlify](https://app.netlify.com)中连接GitHub仓库
3. 构建设置：
   - Build command: `echo 'No build needed'`
   - Publish directory: `.`
4. 部署完成！

详细部署指南请参考 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🔧 技术架构

### 前端技术栈
- **HTML5/CSS3** - 响应式设计
- **JavaScript ES6+** - 现代JavaScript特性
- **Bootstrap 5** - UI框架
- **Font Awesome** - 图标库

### 后端架构
- **Netlify Functions** - 无服务器函数处理API代理
- **Node.js** - 本地开发环境
- **CORS处理** - 完整的跨域请求解决方案
- **会话持久化** - LocalStorage + 2小时自动过期

### 部署平台
- **Netlify** - 静态站点托管 + 无服务器函数
- **GitHub Actions** - 自动化部署（可选）
- **CDN加速** - 全球内容分发网络
- **自定义域名** - 支持HTTPS

## 📋 使用指南

### Giffgaff eSIM申请流程
1. **OAuth登录** - 使用Giffgaff账户登录
2. **邮件验证** - 输入收到的验证码
3. **获取会员信息** - 验证账户状态
4. **申请eSIM** - 预留SIM卡并交换
5. **生成二维码** - 获取LPA激活码

### Simyo设备更换流程
1. **登录账户** - 输入手机号和密码
2. **选择更换类型** - 新申请或设备更换
3. **验证码处理** - 短信或客服验证码
4. **获取eSIM配置** - 生成新的激活码
5. **扫码安装** - 在新设备上安装eSIM

详细使用说明：
- [Giffgaff工具说明](./README_giffgaff_esim.md)
- [Simyo工具说明](./README_simyo_esim.md)

## ⚠️ 重要说明

### 适用范围
- **Giffgaff**: 英国用户专用
- **Simyo**: 荷兰用户专用（06开头手机号）

### 安全提示
- 所有数据处理均在本地进行
- 不存储用户凭据信息
- 建议在安全网络环境下使用

### 部署版本说明

#### 🌟 公共服务版本 (esim.cosr.eu.org)
- **优势**: 完整功能，无CORS限制，即开即用
- **适用**: 普通用户日常使用
- **特点**: 定期维护更新，稳定可靠

#### 🔧 完整部署版本 (simyo_complete_esim.html)
- **优势**: 所有API功能，环境自适应
- **适用**: 自建服务，企业部署
- **特点**: 支持Netlify代理和本地代理服务器

#### 👁️ 静态演示版本 (simyo_static.html)
- **优势**: 纯静态，快速预览界面
- **适用**: 功能演示，界面展示
- **限制**: 受CORS限制，无法调用真实API

## 📁 项目结构

```
esim-tools/
├── index.html                    # 主页面 - 工具选择
├── src/                          # 源代码目录
│   ├── giffgaff/                 # Giffgaff eSIM工具
│   │   └── giffgaff_complete_esim.html
│   └── simyo/                    # Simyo eSIM工具
│       ├── simyo_complete_esim.html  # 完整版（需要代理）
│       ├── simyo_static.html         # 静态版（演示用）
│       └── simyo_proxy_server.js     # CORS代理服务器
├── docs/                         # 文档目录
│   ├── fixes/                    # 问题修复说明
│   │   ├── GIFFGAFF_OAUTH_FIX.md
│   │   └── GIFFGAFF_CSP_CALLBACK_FIX.md
│   ├── guides/                   # 使用指南
│   │   ├── CORS_SOLUTION.md
│   │   └── DEPLOYMENT_GUIDE.md
│   └── reference/                # 参考文档
│       ├── README_giffgaff_esim.md
│       └── README_simyo_esim.md
├── tests/                        # 测试文件
│   ├── test_giffgaff_esim.html
│   └── test_simyo_esim.html
├── scripts/                      # 脚本文件
│   ├── start_simyo_server.sh
│   ├── start_simyo_server.bat
│   └── deploy.sh
├── postman/                      # Postman脚本和参考文件
│   ├── Giffgaff-swap-esim.json
│   ├── Simyo-swap-esim.json
│   ├── giffgaff.html
│   └── simyo.html
├── netlify.toml                  # Netlify部署配置
├── package.json                  # Node.js依赖配置
└── README.md                     # 项目说明
```

### CORS解决方案
静态部署环境下通过以下方式解决跨域问题：
1. **推荐**: 使用公共服务 [esim.cosr.eu.org](https://esim.cosr.eu.org)
2. **Netlify代理重定向**: 自动代理API请求
3. **本地代理服务器**: 运行Node.js代理
4. **浏览器插件**: 临时解决方案

详细解决方案请参考 [docs/guides/CORS_SOLUTION.md](./docs/guides/CORS_SOLUTION.md)

## 🧪 测试

### 运行测试
```bash
# 在浏览器中打开测试页面
open tests/test_giffgaff_esim.html
open tests/test_simyo_esim.html
```

### 测试覆盖
- **单元测试** - 核心函数测试
- **集成测试** - API调用测试
- **端到端测试** - 完整流程测试
- **性能测试** - 响应时间和内存使用

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程
1. Fork仓库
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

### 代码规范
- 使用ESLint进行代码检查
- 遵循现有的代码风格
- 添加必要的注释和文档

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

## 🙏 致谢

- 感谢Giffgaff和Simyo提供的API服务
- 感谢开源社区的技术支持
- 感谢所有贡献者和用户的反馈

## 📞 支持

如果您遇到问题或有建议，请：
- 提交 [GitHub Issue](https://github.com/Silentely/esim-tools/issues)
- 查看 [常见问题解答](./docs/guides/DEPLOYMENT_GUIDE.md#故障排除)
- 参考详细文档和使用指南

---

**免责声明**: 本工具仅供个人使用，请遵守相关服务条款。使用本工具所产生的任何问题，作者不承担责任。