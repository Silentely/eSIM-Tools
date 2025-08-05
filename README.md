# eSIM工具集 🚀

[![Netlify Status](https://api.netlify.com/api/v1/badges/8fc159e2-3996-4e1b-bf9d-1945a3474682/deploy-status)](https://app.netlify.com/projects/esim-tools/deploys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

专为Giffgaff和Simyo用户设计的eSIM管理工具集，支持完整的eSIM申请、设备更换和二维码生成流程。现已支持PWA、Service Worker离线缓存、WebP图片优化等现代Web技术。

## ✨ 功能特性

### 🔧 Giffgaff eSIM工具
- **OAuth 2.0 PKCE认证** - 安全的身份验证流程
- **智能Cookie登录** - 通过Netlify Functions处理，支持所有部署环境
- **MFA多因子验证** - 邮件验证码支持，无服务器架构处理
- **GraphQL API集成** - 完整的API调用链
- **自动二维码生成** - LPA格式激活码
- **设备更换支持** - 完整的SIM卡更换流程
- **状态悬浮提示** - 智能显示完整信息，避免截断

### 📱 Simyo eSIM工具
- **简单登录验证** - 手机号+密码认证
- **设备更换流程** - 支持验证码处理
- **短信验证码** - 自动发送和验证
- **一键二维码生成** - 即时生成可扫描二维码
- **安装确认功能** - 确保eSIM正确激活
- **响应式设计** - 完美适配移动端

### 🚀 性能优化特性
- **PWA支持** - 可安装为原生应用
- **Service Worker** - 离线缓存和后台同步
- **资源压缩** - CSS/JS/HTML自动压缩
- **WebP图片优化** - 更小的图片文件
- **微交互动画** - 流畅的用户体验
- **触摸反馈优化** - 移动端友好
- **加载状态指示** - 实时进度反馈
- **GPU加速** - 高性能动画渲染

## 🌐 在线使用

### 🚀 公共服务（推荐）
- **完整功能版本**: [https://esim.cosr.eu.org](https://esim.cosr.eu.org)
  - 无CORS限制，完整API功能
  - 支持所有eSIM操作
  - PWA支持，可安装为应用
  - 定期更新维护

### 💰 优惠信息

#### Simyo优惠
新用户开卡可享受**额外5欧元话费赠送**！[立即开卡](https://vriendendeal.simyo.nl/prepaid/AZzwPzb)

#### Giffgaff优惠
使用邀请链接注册Giffgaff账户，享受**5英镑话费奖励**！[立即注册](https://www.giffgaff.com/orders/affiliate/mowal44_1653194386268)


## 🚀 本地部署

### 快速开始

1. **克隆仓库**
   ```bash
   git clone https://github.com/Silentely/esim-tools.git
   cd esim-tools
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建优化版本**
   ```bash
   npm run build
   ```

4. **启动开发服务器**
   ```bash
   # Windows
   start_simyo_server.bat
   
   # macOS/Linux
   ./start_simyo_server.sh
   
   # 或手动启动
   npm start
   ```

5. **访问应用**
   ```
   http://localhost:3000
   ```

### 环境要求

#### 生产环境
- **无特殊要求** - 纯静态部署 + Netlify Functions
- **现代浏览器** - Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **PWA支持** - 支持Service Worker的现代浏览器

#### 开发环境
- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **ImageMagick** (可选，用于图片优化)

### 构建命令

```bash
# 完整构建（CSS压缩 + JS压缩 + HTML压缩）
npm run build

# 仅CSS构建
npm run build:css

# 仅JS构建
npm run build:js

# 仅HTML构建
npm run build:html

# 图片优化
npm run optimize:images

# 完整优化（构建 + 图片优化）
npm run optimize
```

## 📦 Netlify部署

### 自动部署
```bash
npm run deploy
```

### 手动部署
1. Fork此仓库
2. 在[Netlify](https://app.netlify.com)中连接GitHub仓库
3. 构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 部署完成！

## 🔧 技术架构

### 前端技术栈
- **HTML5/CSS3** - 响应式设计
- **JavaScript ES6+** - 现代JavaScript特性
- **Bootstrap 5** - UI框架
- **Font Awesome** - 图标库
- **PWA技术** - Service Worker, Web App Manifest
- **性能优化** - 资源压缩、图片优化、微交互

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

### 性能优化
- **资源预加载** - 关键CSS/JS预加载
- **图片优化** - WebP格式 + 响应式图片
- **代码压缩** - Terser + CSSnano + PostCSS
- **缓存策略** - Service Worker离线缓存
- **动画优化** - GPU加速 + 减少重绘

## 📋 使用指南

### Giffgaff eSIM申请流程
1. **OAuth登录** - 使用Giffgaff账户登录
2. **邮件验证** - 输入收到的验证码
3. **获取会员信息** - 验证账户状态
4. **申请eSIM** - 预留SIM卡并手动激活
5. **生成二维码** - 获取LPA激活码
6. **状态悬浮提示** - 鼠标悬停查看完整信息

### Simyo设备更换流程
1. **登录账户** - 输入手机号和密码
2. **选择更换类型** - 新申请或设备更换
3. **验证码处理** - 短信或客服验证码
4. **获取eSIM配置** - 生成新的激活码
5. **扫码安装** - 在新设备上安装eSIM
6. **触摸反馈** - 移动端优化的交互体验

详细使用说明：
- [Giffgaff工具说明](./docs/reference/README_giffgaff_esim.md)
- [Simyo工具说明](./docs/reference/README_simyo_esim.md)

## ⚠️ 重要说明

### 适用范围
- **Giffgaff**: 英国用户专用
- **Simyo**: 荷兰用户专用（06开头手机号）

### 安全提示
- 所有数据处理均在本地进行
- 不存储用户凭据信息
- 建议在安全网络环境下使用

### 使用方式说明

#### 🌟 推荐方式：在线服务 ([https://esim.cosr.eu.org](https://esim.cosr.eu.org))
- **优势**: 无需部署，即开即用，无CORS限制，PWA支持
- **适用**: 普通用户日常使用
- **特点**: 定期维护更新，稳定可靠，完整功能，性能优化

#### 🔧 自建部署：本地/私有服务
- **文件**: `giffgaff_complete_esim.html` + `simyo_complete_esim.html`
- **优势**: 数据私有，可定制修改，离线使用
- **适用**: 企业部署，开发者，隐私要求高的用户
- **要求**: 需要代理服务器解决CORS问题（支持Netlify Functions或本地Node.js）
- **注意**: 静态部署版本已停止维护，推荐使用在线服务

## 📁 项目结构

```
esim-tools/
├── index.html                    # 主页面 - 工具选择
├── manifest.json                 # PWA应用清单
├── sw.js                        # Service Worker
├── postcss.config.js            # PostCSS配置
├── package.json                 # 项目依赖配置
├── server.js                    # Node.js开发服务器
├── src/                         # 源代码目录
│   ├── giffgaff/                # Giffgaff eSIM工具
│   │   └── giffgaff_complete_esim.html
│   ├── simyo/                   # Simyo eSIM工具
│   │   └── simyo_complete_esim.html
│   └── styles/                  # 样式文件
│       ├── design-system.css    # 设计系统
│       └── enhanced-animations.css # 增强动画
├── dist/                        # 构建输出目录
│   ├── index.html               # 压缩后的主页面
│   ├── giffgaff.html           # 压缩后的Giffgaff工具
│   ├── simyo.html              # 压缩后的Simyo工具
│   ├── styles/                 # 压缩后的CSS
│   └── scripts/                # 压缩后的JS
├── scripts/                     # 构建和部署脚本
│   ├── build-html.js           # HTML构建脚本
│   ├── optimize-images.js      # 图片优化脚本
│   ├── deploy.sh               # 自动部署脚本
│   ├── start_simyo_server.sh   # Linux/macOS启动脚本
│   └── start_simyo_server.bat  # Windows启动脚本
├── netlify/                     # Netlify无服务器函数
│   └── functions/               # 生产环境API代理
├── docs/                        # 文档目录
│   ├── fixes/                   # 问题修复说明
│   ├── guides/                  # 使用指南
│   └── reference/               # 参考文档
├── tests/                       # 测试文件
├── postman/                     # 原始API脚本（参考）
├── netlify.toml                 # Netlify部署配置
└── README.md                    # 项目说明文档
```

## 🧪 测试

### 运行测试
```bash
# 在浏览器中打开测试页面
open tests/test_giffgaff_esim.html
open tests/test_simyo_esim.html
```

### 性能测试
```bash
# 构建并测试性能
npm run build
npm run optimize
```

### 测试覆盖
- **单元测试** - 核心函数测试
- **集成测试** - API调用测试
- **端到端测试** - 完整流程测试
- **性能测试** - 响应时间和内存使用
- **PWA测试** - Service Worker和离线功能

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
- 确保性能优化和PWA兼容性

## 🙏 致谢

- 感谢Giffgaff和Simyo提供的API服务
- 感谢开源社区的技术支持
- 感谢所有贡献者和用户的反馈

## 📞 支持

如果您遇到问题或有建议，请：
- 提交 [GitHub Issue](https://github.com/Silentely/esim-tools/issues)
- 查看 [常见问题解答](./docs/guides/DEPLOYMENT_GUIDE.md#故障排除)
- 参考详细文档和使用指南

## 📋 更新日志

### v2.0.0 (2025-08-05)
- ✨ 新增PWA支持，可安装为原生应用
- 🚀 新增Service Worker离线缓存
- 🎨 新增微交互动画和触摸反馈
- 📱 优化移动端用户体验
- 🖼️ 新增WebP图片优化
- ⚡ 新增资源压缩和性能优化
- 🔧 新增构建工具链
- 📊 新增加载状态指示器

### v1.x.x
- 基础eSIM申请功能
- OAuth认证和MFA验证
- 二维码生成和下载
- 设备更换流程支持

## 免责声明

本工具仅供个人使用，请遵守相关服务条款。使用本工具所产生的任何问题，作者不承担责任。

## 许可证

- 本项目的所有代码除另有说明外,均按照 [MIT License](LICENSE) 发布。
- 本项目的README.MD，wiki等资源基于 [CC BY-NC-SA 4.0][CC-NC-SA-4.0] 这意味着你可以拷贝、并再发行本项目的内容，<br/>
  但是你将必须同样**提供原作者信息以及协议声明**。同时你也**不能将本项目用于商业用途**，按照我们狭义的理解<br/>
  (增加附属条款)，凡是**任何盈利的活动皆属于商业用途**。
- 请在遵守当地相关法律法规的前提下使用本项目。

<p align="center">
  <img src="https://github.com/docker/dockercraft/raw/master/docs/img/contribute.png?raw=true" alt="贡献图示">
</p>

[github-hosts]: https://raw.githubusercontent.com/racaljk/hosts/master/hosts "hosts on Github"
[CC-NC-SA-4.0]: https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh

<div align="center">
  <sub>Made with ❤️ by <a href="https://github.com/Silentely">Silentely</a></sub>
</div>
