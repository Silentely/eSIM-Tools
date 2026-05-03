# eSIM工具集项目总结

## 项目概述

eSIM工具集是一个专为Giffgaff和Simyo用户设计的eSIM管理工具集，旨在简化eSIM的申请、配置和管理过程。该项目包含两个主要工具：

1. **Giffgaff eSIM工具** - 支持完整的OAuth认证、MFA验证和GraphQL API调用
2. **Simyo eSIM工具** - 提供简化的登录验证、设备更换和验证码处理功能

## 技术架构

### 前端技术栈
- **HTML5/CSS3** - 语义化结构和响应式设计
- **Bootstrap 5.3.0** - UI框架
- **Font Awesome 6.0.0** - 图标库
- **原生JavaScript (ES6+)** - 交互逻辑和API集成

### 后端技术栈
- **Node.js/Express** - 本地开发服务器和API代理
- **Netlify Functions** - 生产环境无服务器函数
- **CORS代理** - 解决跨域问题

### API集成
- **Giffgaff API** - OAuth 2.0 PKCE认证、MFA验证、GraphQL API
- **Simyo API** - 会话管理、eSIM配置获取
- **QR Code API** - 二维码生成服务

## 项目结构

```
eSIM-Tools/
├── src/
│   ├── js/
│   │   ├── giffgaff.js                 # Giffgaff Webpack入口
│   │   ├── simyo.js                    # Simyo Webpack入口
│   │   └── modules/
│   │       ├── giffgaff/               # Giffgaff模块化组件 (app/state/oauth/api/dom/utils)
│   │       ├── simyo/                  # Simyo模块化组件 (app/api)
│   │       └── (通用工具: logger, captcha-manager, api-service, html-sanitizer 等)
│   ├── giffgaff/                       # Legacy Giffgaff页面 (兼容保留)
│   │   ├── giffgaff_modular.html
│   │   ├── js/modules/                 # Legacy模块 (oauth-handler, mfa-handler 等)
│   │   └── styles/                     # Giffgaff专属样式
│   ├── simyo/                          # Legacy Simyo页面 (兼容保留)
│   │   ├── simyo_modular.html
│   │   ├── js/modules/                 # Legacy模块 (auth-handler, esim-service 等)
│   │   └── styles/                     # Simyo专属样式
│   └── styles/                         # 全局样式 (design-system, notification 等)
├── netlify/
│   ├── functions/                      # Serverless后端函数 (11个)
│   └── edge-functions/                 # BFF代理层 (密钥注入 + 验证码验证)
├── tests/                              # Jest单元测试
├── scripts/                            # 构建与质量检查脚本
├── docs/                               # 使用指南、API参考、修复记录
├── index.html                          # 入口页面
├── server.js                           # 本地开发服务器 (Express)
├── webpack.config.js                   # Webpack构建配置
├── package.json                        # 项目配置
└── netlify.toml                        # Netlify部署配置
```

## 核心功能

### Giffgaff eSIM工具
1. **OAuth 2.0 PKCE认证**
   - 安全的授权码流程
   - 支持`giffgaff://`协议回调URL解析
   - Cookie登录支持（现代化Node.js架构）

2. **MFA验证**
   - 邮件验证码发送和验证
   - 签名生成和验证

3. **GraphQL API集成**
   - 会员信息获取
   - eSIM预订和SIM卡交换
   - eSIM下载令牌获取

4. **二维码生成**
   - 自动LPA字符串生成
   - QR码显示和下载

### Simyo eSIM工具
1. **账户登录**
   - 荷兰手机号格式验证（06开头10位数字）
   - 会话令牌管理

2. **设备更换支持**
   - 完整的设备更换流程
   - 短信验证码处理
   - 客服验证码支持

3. **eSIM管理**
   - eSIM配置获取
   - 二维码生成和显示
   - 安装确认功能

## 部署方案

### 开发环境
- **本地服务器** - 使用`npm run dev`启动Node.js服务器
- **CORS代理** - 解决开发环境跨域问题

### 生产环境
- **Netlify部署** - 静态文件托管和无服务器函数
- **API代理** - 通过Netlify重定向解决CORS问题
- **自动HTTPS** - Netlify提供的安全连接

## 安全特性

1. **CSP配置** - 严格的内容安全策略
2. **HTTPS强制** - 所有API调用使用安全连接
3. **输入验证** - 严格的手机号和Cookie格式验证
4. **会话管理** - 自动过期和清理机制
5. **隐私保护** - 所有数据处理均在本地进行

## 测试框架

项目包含完整的测试套件：
- **单元测试** - 函数验证、URL解析、状态管理
- **集成测试** - API调用、认证流程、eSIM处理
- **端到端测试** - 完整流程、错误处理、响应式设计
- **性能测试** - API响应时间、内存使用监控

## 部署和运行

### 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问应用
http://localhost:3000
```

### 生产部署
```bash
# 部署到Netlify
npm run deploy
```

## 项目维护

### 文档完善
- 详细的使用指南和故障排除
- API参考文档
- 部署和配置说明

### 持续改进
- 定期更新依赖包
- 修复已知问题
- 优化用户体验
- 增强安全特性

## 许可证

本项目采用MIT许可证，允许自由使用、修改和分发。

## 免责声明

此工具仅供学习和个人使用，请遵守相关服务条款。开发者不对因使用此工具造成的任何损失承担责任。