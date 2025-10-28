<div align="center">
<h1 align="center">eSIM Tools 🚀<br><img align='middle' src='https://anay.cosr.eu.org/?text=@Silentely/eSIM-Tools'></img></h1>
<img align='middle' src='https://anay.cosr.eu.org/?repo=Silentely/eSIM-Tools'></img>
<br>
<img src="https://img.shields.io/github/forks/Silentely/eSIM-Tools?color=orange" alt="GitHub forks">
<img src="https://img.shields.io/github/issues/Silentely/eSIM-Tools?color=green" alt="GitHub issues">
<br>
<img src="https://img.shields.io/github/license/Silentely/eSIM-Tools?color=ff69b4" alt="License">
<img src="https://img.shields.io/github/languages/code-size/Silentely/eSIM-Tools?color=blueviolet" alt="Code size">
<img src="https://img.shields.io/github/last-commit/Silentely/eSIM-Tools/main?label=%E4%B8%8A%E6%AC%A1%E6%9B%B4%E6%96%B0&color=success" alt="Last commit">
<img src="https://api.netlify.com/api/v1/badges/8fc159e2-3996-4e1b-bf9d-1945a3474682/deploy-status" alt="Netlify Status">
<br>
</div>

专为Giffgaff和Simyo用户设计的现代化eSIM管理工具集，支持完整的eSIM申请、激活和二维码生成流程。

## ✨ 功能特性

### 🇬🇧 Giffgaff eSIM工具
- **OAuth 2.0 PKCE认证** - 安全的身份验证流程
- **智能Cookie登录** - 支持免OAuth快速登录
- **MFA多因子验证** - 邮件/短信验证码支持
- **短信验证码激活** - 全自动eSIM申请与激活（✅ 推荐）
- **GraphQL API集成** - 完整的API调用链
- **LPA二维码生成** - 标准eSIM激活码
- ~~**手动激活引导**~~ - 已于2025年10月8日停用

### 🇳🇱 Simyo eSIM工具
- **账户登录验证** - 荷兰手机号格式验证
- **设备更换支持** - 完整的SIM卡更换流程
- **短信验证码** - 自动发送和验证处理
- **即时二维码生成** - 一键生成可扫描激活码
- **安装确认** - 确保eSIM正确激活

## 🖼️ 界面预览

> 下方为主要页面的功能截图预览，便于快速了解工具界面与核心操作路径。

### 主页

![主页-功能总览](./src/assets/images/home-preview.jpg)

### Giffgaff eSIM 工具

![Giffgaff-工具界面](./src/assets/images/giffgaff-preview.jpg)

### Simyo eSIM 工具

![Simyo-工具界面](./src/assets/images/simyo-preview.jpg)

## 🌐 在线使用

### 🚀 在线服务（推荐）
**完整功能版本**: [https://esim.cosr.eu.org](https://esim.cosr.eu.org)
- ✅ 无CORS限制，完整API功能
- ✅ 支持所有eSIM操作和流程
- ✅ 性能优化，支持离线使用
- ✅ 定期更新维护

### 🎁 新用户优惠
- **Simyo用户**: 新开卡享受[额外5欧元话费赠送](https://vriendendeal.simyo.nl/prepaid/AZzwPzb)
- **Giffgaff用户**: 新开卡享受[额外5英镑话费赠送](https://www.giffgaff.com/orders/affiliate/mowal44_1653194386268)

## 📋 使用指南

### 🇬🇧 Giffgaff eSIM申请流程（推荐：短信验证码激活）
1. **身份验证** - OAuth登录或Cookie快速登录
2. **邮件/短信验证** - 输入收到的MFA验证码
3. **获取会员信息** - 自动获取账户信息
4. **短信验证码激活** - 选择"短信验证码激活"（推荐）
   - 点击"发送验证码"
   - 输入收到的6位短信验证码
   - 系统自动完成预订、交换和激活
5. **获取二维码** - 自动生成LPA激活码和二维码

> ✅ **推荐使用短信验证码激活**：全自动流程，无需手动操作
>
> ⚠️ **已停用功能**：手动激活方式已于2025年10月8日被官方修复停用
>
> 📖 **详细教程**：查看 [Giffgaff使用教程](./docs/User_Guide.md) 获取图文并茂的完整操作指南

### 🇳🇱 Simyo eSIM申请流程
1. **账户登录** - 输入荷兰手机号(06开头)和密码
2. **选择服务** - 新申请或设备更换
3. **验证码处理** - 短信或客服验证码验证
4. **获取配置** - 系统生成eSIM配置信息
5. **扫码安装** - 使用生成的二维码在新设备上安装

### 📚 详细文档
- **[Giffgaff使用教程](./docs/User_Guide.md)** - 图文并茂的完整操作指南（推荐优先阅读）
- [Giffgaff详细说明](./docs/reference/README_giffgaff_esim.md)
- [Simyo详细说明](./docs/reference/README_simyo_esim.md)
- [性能优化指南](./docs/PERFORMANCE.md)

## 🚀 本地部署

### 快速开始

1. **克隆仓库**
   ```bash
   git clone https://github.com/Silentely/eSIM-Tools.git
   cd eSIM-Tools
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动代理服务器**
   ```bash
   # Windows
   start_simyo_server.bat
   
   # macOS/Linux
   ./start_simyo_server.sh
   
   # 或手动启动
   npm start
   ```

4. **访问应用**
   ```
   http://localhost:3000
   ```

### 环境要求
- **现代浏览器**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **开发环境**: Node.js >= 18.0.0, npm >= 8.0.0 (仅本地开发需要)

## 🔧 技术架构

### 前端技术栈
- **HTML5/CSS3** - 响应式设计，现代化UI
- **JavaScript ES6+** - 模块化架构，现代语法特性
- **Bootstrap 5** - 响应式UI框架
- **Service Worker** - 离线支持和缓存优化

### 后端架构
- **生产环境**: Netlify Functions - 无服务器函数处理API代理
- **开发环境**: Node.js Express - 本地开发服务器
- **CORS处理** - 统一跨域请求解决方案
- **会话管理** - 安全的本地存储和自动过期机制

### 🚀 性能优化
- **资源压缩**: Webpack + TerserPlugin，压缩率65%+
- **Service Worker**: 离线缓存和网络状态监控
- **图片优化**: WebP格式支持，自动压缩
- **代码分割**: 自动分离第三方库，减少初始加载时间

> 详细性能优化说明请参考 [PERFORMANCE.md](./docs/PERFORMANCE.md)

### 服务时间说明
- **Giffgaff服务窗口**: 英国时间 04:30 – 21:30 (Europe/London)
- **窗口外操作**: 可能失败或不稳定，UI会显示本地时间与英国时间对比

## 📦 部署方式

### 🌟 推荐：在线服务
使用托管版本 [https://esim.cosr.eu.org](https://esim.cosr.eu.org)
- 无需部署配置，即开即用
- 自动更新，稳定可靠
- 完整功能支持

### 🔧 自建部署：Netlify
1. Fork此仓库到您的GitHub账户
2. 在[Netlify](https://app.netlify.com)中连接GitHub仓库
3. 构建设置：
   - Build command: `echo 'No build needed'`
   - Publish directory: `.`
4. 部署完成，获得您的专属域名

### ⚙️ 本地开发
```bash
# 克隆仓库
git clone https://github.com/Silentely/eSIM-Tools.git
cd eSIM-Tools

# 安装依赖并启动
npm install
npm start

# 访问 http://localhost:3000
```

## ❓ 常见问题

### Giffgaff相关
**Q: 推荐使用哪种激活方式？**
A: 推荐使用"短信验证码激活"，全自动流程，只需输入短信验证码即可完成所有步骤。

**Q: 短信验证码激活需要多久？**
A: 通常1-2分钟即可完成。发送验证码→输入验证码→自动完成预订、交换和激活→获取二维码。

**Q: 手动激活方式还能用吗？**
A: 手动激活方式已于2025年10月8日被Giffgaff官方修复停用，请使用短信验证码激活。

**Q: 误关页面怎么办？**
A: 重新登录后系统会从可恢复节点继续。建议激活完成前保持页面开启。

### Simyo相关
**Q: 支持哪些手机号格式？**
A: 仅支持荷兰手机号（06开头的10位数字）。

**Q: 验证码收不到怎么办？**
A: 可选择客服验证码选项，或检查短信拦截设置。

## ⚠️ 重要说明

### 适用范围
- **Giffgaff**: 英国用户专用
- **Simyo**: 荷兰用户专用（06开头手机号）

### 安全与隐私
- ✅ 所有数据处理均在本地进行
- ✅ 不存储用户凭据信息
- ✅ 建议在安全网络环境下使用
- ✅ 开源透明，代码可审计

## 📁 项目结构

```
eSIM-Tools/
├── 📄 index.html                 # 主页面
├── 🖥️ server.js                  # 本地开发服务器
├── 📦 package.json               # 项目配置
├── 📂 src/                       # 源代码
│   ├── 🇬🇧 giffgaff/             # Giffgaff工具
│   ├── 🇳🇱 simyo/                # Simyo工具
│   ├── 🎨 styles/                # 样式文件
│   └── ⚙️ js/                    # JavaScript模块
├── 🌐 netlify/                   # 无服务器函数
│   └── functions/                # API代理
├── 📚 docs/                      # 项目文档
│   ├── guides/                   # 使用指南
│   ├── reference/                # 参考文档
│   └── fixes/                    # 问题修复
├── 🧪 tests/                     # 测试文件
└── 🛠️ scripts/                   # 部署脚本
```

### 跨域解决方案
1. **🌟 推荐**: 使用在线服务 [esim.cosr.eu.org](https://esim.cosr.eu.org)
2. **🔧 Netlify Functions**: 自动API代理
3. **💻 本地代理**: Node.js开发服务器
4. **📖 详细说明**: [CORS解决方案文档](./docs/guides/CORS_SOLUTION.md)

## 🧪 测试

项目包含完整的测试套件：
- **单元测试** - 核心函数和模块测试
- **集成测试** - API调用和流程测试
- **端到端测试** - 完整用户流程验证

```bash
# 运行测试套件
npm test

# 在浏览器中测试
open tests/test_giffgaff_esim.html
open tests/test_simyo_esim.html
```

## 🤝 贡献指南

欢迎贡献代码和提出建议！

### 参与方式
1. 🍴 Fork项目仓库
2. 🌿 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 💾 提交更改 (`git commit -m 'Add AmazingFeature'`)
4. 📤 推送分支 (`git push origin feature/AmazingFeature`)
5. 🔃 创建Pull Request

### 开发规范
- 遵循现有代码风格
- 添加必要的测试用例
- 更新相关文档

## 📞 支持与反馈

遇到问题或有建议？
- 📋 [提交Issue](https://github.com/Silentely/eSIM-Tools/issues)
- 📖 查看[项目文档](./docs/)
- 💬 参与社区讨论

## 📄 许可证

- 本项目的所有代码除另有说明外,均按照 [MIT License](LICENSE) 发布。
- 本项目的README.MD，wiki等资源基于 [CC BY-NC-SA 4.0][CC-NC-SA-4.0] 这意味着你可以拷贝、并再发行本项目的内容，<br/>
  但是你将必须同样**提供原作者信息以及协议声明**。同时你也**不能将本项目用于商业用途**，按照我们狭义的理解<br/>
  (增加附属条款)，凡是**任何盈利的活动皆属于商业用途**。
- 请在遵守当地相关法律法规的前提下使用本项目。

## ⚖️ 免责声明
<p align="center">
  <img src="https://github.com/docker/dockercraft/raw/master/docs/img/contribute.png?raw=true" alt="贡献图示">
</p>
本工具仅供学习和个人使用，请遵守相关服务条款。使用本工具产生的任何问题，开发者不承担责任。请在遵守当地法律法规的前提下使用。

[github-hosts]: https://raw.githubusercontent.com/racaljk/hosts/master/hosts "hosts on Github"
[CC-NC-SA-4.0]: https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh

<div align="center">
  <sub>Made with ❤️ by <a href="https://github.com/Silentely">Silentely</a></sub>
</div>
