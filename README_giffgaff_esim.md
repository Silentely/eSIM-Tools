# Giffgaff eSIM 申请工具

基于Giffgaff-swap-esim.json Postman脚本构建的完整eSIM申请网页工具。

## 🚀 项目概述

这是一个完整的Web应用程序，允许用户通过浏览器直接申请和获取Giffgaff eSIM，无需使用移动应用或复杂的API工具。

### 核心功能
- ✅ OAuth 2.0 PKCE 认证流程
- ✅ 邮件验证码(MFA)验证
- ✅ GraphQL API 完整集成
- ✅ eSIM 预订和SIM卡交换
- ✅ eSIM 下载码生成和二维码显示
- ✅ 响应式设计，支持移动设备
- ✅ 完整的错误处理和用户体验优化

## 📁 文件说明

### 主要文件
- **`giffgaff_complete_esim.html`** - 完整的eSIM申请工具（生产版本）
- **`test_giffgaff_esim.html`** - 综合测试页面（开发/测试版本）
- **`Giffgaff-swap-esim.json`** - 原始Postman脚本（参考文档）
- **`giffgaff.html`** - 原有的简化版本（参考）

### 参考文件
- **`simyo.html`** - Simyo eSIM工具（其他运营商参考）
- **`Simyo ESIM V2.postman_collection.json`** - Simyo API脚本

## 🔧 技术架构

### 前端技术栈
- **HTML5** - 语义化结构
- **CSS3** - 响应式设计，Bootstrap 5.3.0
- **JavaScript (ES6+)** - 现代JavaScript特性
- **Font Awesome 6.0.0** - 图标库

### API集成
- **OAuth 2.0 PKCE** - 安全认证流程
- **Giffgaff ID API** - 用户认证和MFA
- **Giffgaff GraphQL API** - 业务逻辑处理
- **QR Code API** - 二维码生成服务

### 关键API端点
```javascript
const apiEndpoints = {
    mfaChallenge: "https://id.giffgaff.com/v4/mfa/challenge/me",
    mfaValidation: "https://id.giffgaff.com/v4/mfa/validation", 
    graphql: "https://publicapi.giffgaff.com/gateway/graphql",
    qrcode: "https://qrcode.show/"
};
```

## 🚦 使用流程

### 步骤1: OAuth登录
1. 点击"开始OAuth登录"
2. 在弹出的页面完成Giffgaff账户登录
3. 复制回调URL并粘贴到输入框
4. 点击"处理回调"获取访问令牌

### 步骤2: 邮件验证
1. 点击"发送邮件验证码"
2. 检查邮箱收到的6位验证码
3. 输入验证码并点击"验证邮件验证码"

### 步骤3: 获取会员信息
1. 点击"获取会员信息"
2. 系统将显示您的Giffgaff账户详情

### 步骤4: 申请eSIM
1. 点击"预订eSIM"获取新的eSIM
2. 点击"交换SIM卡"完成从物理SIM到eSIM的转换

### 步骤5: 获取二维码
1. 点击"获取eSIM Token"
2. 系统将生成LPA字符串和二维码
3. 保存二维码图片或复制LPA字符串到支持eSIM的设备

## ⚠️ 重要提示

### 安全警告
- **实体SIM卡将失效** - 执行SIM交换后，原有物理SIM卡将无法使用
- **立即保存信息** - 页面关闭后无法再次获取eSIM信息
- **仅限个人使用** - 请勿分享您的OAuth令牌或eSIM信息

### 系统要求
- **现代浏览器** - Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **HTTPS环境** - 由于安全限制，某些功能需要HTTPS
- **JavaScript启用** - 必须启用JavaScript才能正常工作

### 兼容性
- ✅ 桌面端 (Windows, macOS, Linux)
- ✅ 移动端 (iOS, Android)
- ✅ 平板设备
- ⚠️ 部分老旧浏览器可能不支持

## 🧪 测试

使用 `test_giffgaff_esim.html` 进行功能测试：

### 测试类别
1. **单元测试** - OAuth函数、URL解析、状态管理、UI组件
2. **集成测试** - OAuth流程、MFA验证、GraphQL API、eSIM处理
3. **端到端测试** - 完整流程、错误处理、响应式设计
4. **性能测试** - API响应时间、内存使用监控

### 运行测试
1. 打开 `test_giffgaff_esim.html`
2. 配置模拟数据（可选）
3. 点击"运行所有测试"或选择特定测试类别
4. 查看测试结果和详细日志

## 📝 开发说明

### 核心组件架构
```javascript
// 全局状态管理
const appState = {
    accessToken: "",      // OAuth访问令牌
    codeVerifier: "",     // PKCE代码验证器
    emailCodeRef: "",     // 邮件验证引用
    emailSignature: "",   // MFA签名
    memberId: "",         // 会员ID
    esimSSN: "",         // eSIM序列号
    lpaString: "",        // LPA下载字符串
    currentStep: 1        // 当前步骤
};
```

### 主要函数说明
- `generateCodeVerifier()` - 生成PKCE代码验证器
- `generateCodeChallenge()` - 生成PKCE代码挑战
- `showSection(stepNumber)` - 显示指定步骤
- `showStatus(element, message, type)` - 显示状态信息
- `generateQRCode(data)` - 生成二维码

### GraphQL查询示例
```graphql
# 获取会员信息
query getMemberProfileAndSim {
    memberProfile {
        id
        memberName
        __typename
    }
    sim {
        phoneNumber
        status
        __typename
    }
}

# 预订eSIM
mutation reserveESim($input: ESimReservationInput!) {
    reserveESim: reserveESim(input: $input) {
        id
        esim {
            ssn
            activationCode
            __typename
        }
        __typename
    }
}
```

## 🤝 贡献指南

### 开发环境设置
1. 克隆或下载项目文件
2. 使用本地HTTP服务器运行（推荐使用HTTPS）
3. 配置测试数据和API端点

### 代码规范
- 使用ES6+现代JavaScript语法
- 遵循语义化HTML结构
- 保持CSS模块化和响应式设计
- 添加详细的错误处理和用户反馈

### 测试要求
- 新功能必须包含相应的测试用例
- 确保所有现有测试通过
- 性能测试确保响应时间合理

## 📄 许可证

本项目基于原始Postman脚本开发，仅供学习和个人使用。请遵守Giffgaff的服务条款和API使用政策。

## 🙋‍♂️ 支持

如有问题或建议，请：
1. 首先使用测试页面验证功能
2. 检查浏览器控制台错误信息
3. 确认网络连接和API可用性
4. 查阅Giffgaff官方文档

---

**免责声明**: 此工具仅为方便用户使用而开发，使用前请确保了解eSIM转换的风险和后果。开发者不对因使用此工具造成的任何损失承担责任。