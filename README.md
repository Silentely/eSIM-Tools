# eSIM工具集 🚀

[![Netlify Status](https://api.netlify.com/api/v1/badges/your-site-id/deploy-status)](https://app.netlify.com/sites/your-site-name/deploys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

专为Giffgaff和Simyo用户设计的eSIM管理工具集，支持完整的eSIM申请、设备更换和二维码生成流程。

## ✨ 功能特性

### 🔧 Giffgaff eSIM工具
- **OAuth 2.0 PKCE认证** - 安全的身份验证流程
- **MFA多因子验证** - 邮件验证码支持
- **GraphQL API集成** - 完整的API调用链
- **自动二维码生成** - LPA格式激活码
- **设备更换支持** - 完整的SIM卡更换流程

### 📱 Simyo eSIM工具
- **简单登录验证** - 手机号+密码认证
- **设备更换流程** - 支持验证码处理
- **短信验证码** - 自动发送和验证
- **一键二维码生成** - 即时生成可扫描二维码
- **安装确认功能** - 确保eSIM正确激活

## 🌐 在线使用

### 主要入口
- **工具选择页面**: [https://esim.yyxx.com/](https://esim.yyxx.com/)
- **Giffgaff工具**: [https://esim.yyxx.com/giffgaff](https://esim.yyxx.com/giffgaff)
- **Simyo工具**: [https://esim.yyxx.com/simyo](https://esim.yyxx.com/simyo)

### 💰 优惠信息
新用户开卡可享受**额外5欧元话费赠送**！[立即开卡](https://vriendendeal.simyo.nl/prepaid/AZzwPzb)

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
- Node.js >= 14.0.0
- 现代浏览器（Chrome 80+, Firefox 75+, Safari 13+, Edge 80+）

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

### 后端代理
- **Node.js + Express** - 代理服务器
- **CORS处理** - 跨域请求解决方案
- **API转发** - 透明代理到运营商API

### 部署平台
- **Netlify** - 静态站点托管
- **GitHub Actions** - 自动化部署（可选）
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

### CORS解决方案
静态部署环境下通过以下方式解决跨域问题：
- Netlify代理重定向（推荐）
- 浏览器CORS插件
- 本地代理服务器

详细解决方案请参考 [CORS_SOLUTION.md](./CORS_SOLUTION.md)

## 🧪 测试

### 运行测试
```bash
# 在浏览器中打开测试页面
open test_giffgaff_esim.html
open test_simyo_esim.html
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
- 查看 [常见问题解答](./DEPLOYMENT_GUIDE.md#故障排除)
- 参考详细文档和使用指南

---

**免责声明**: 本工具仅供个人使用，请遵守相关服务条款。使用本工具所产生的任何问题，作者不承担责任。