# Simyo NL eSIM 申请工具

基于Simyo ESIM V2.postman_collection.json Postman脚本构建的完整eSIM申请网页工具。

## 🚀 项目概述

这是一个专为Simyo NL（荷兰）用户设计的Web应用程序，允许用户通过浏览器直接申请和管理Simyo eSIM，无需使用移动应用或复杂的API工具。

### 核心功能
- ✅ Simyo账户认证登录
- ✅ eSIM配置信息获取
- ✅ eSIM二维码生成和显示
- ✅ 设备更换支持
- ✅ 安装确认功能
- ✅ 响应式设计，支持移动设备
- ✅ 完整的错误处理和用户体验优化

## 📁 文件说明

### 主要文件
- **`simyo_complete_esim.html`** - 完整的Simyo eSIM申请工具（生产版本）
- **`test_simyo_esim.html`** - 综合测试页面（开发/测试版本）
- **`Simyo ESIM V2.postman_collection.json`** - 原始Postman脚本（参考文档）
- **`simyo.html`** - 原有的简化版本（参考）

## 🔧 技术架构

### 前端技术栈
- **HTML5** - 语义化结构
- **CSS3** - 响应式设计，Bootstrap 5.3.0，Simyo品牌配色
- **JavaScript (ES6+)** - 现代JavaScript特性
- **Font Awesome 6.0.0** - 图标库

### API集成
- **Simyo Sessions API** - 用户认证和会话管理
- **Simyo eSIM API** - eSIM配置获取和管理
- **QR Code API** - 二维码生成服务

### 关键API端点
```javascript
const apiEndpoints = {
    login: "https://appapi.simyo.nl/simyoapi/api/v1/sessions",
    getEsim: "https://appapi.simyo.nl/simyoapi/api/v1/esim/get-by-customer",
    confirmInstall: "https://appapi.simyo.nl/simyoapi/api/v1/esim/reorder-profile-installed",
    qrcode: "https://api.qrserver.com/v1/create-qr-code/"
};
```

## 🚦 使用流程

### 初次注册并安装eSIM

#### 步骤1: 账户登录
1. 输入您的Simyo手机号码（06开头，10位数字）
2. 输入Simyo账户密码
3. 点击"登录账户"进行身份验证

#### 步骤2: 获取eSIM信息
1. 点击"获取eSIM"
2. 系统将从Simyo服务器获取您的eSIM配置信息
3. 显示激活码、状态和关联号码等详细信息

#### 步骤3: 生成eSIM二维码
1. 点击"生成二维码"
2. 系统将创建LPA格式的激活码
3. 生成二维码供设备扫描安装
4. 可复制LPA字符串或下载二维码图片

#### 步骤4: 确认安装（可选）
1. 仅在APP无法登录或更换设备时需要
2. 点击"确认安装"验证eSIM状态

### 设备更换流程

本工具现已支持完整的设备更换流程，包括验证码处理：

#### 方式一：使用本工具完成设备更换（推荐）

1. **登录账户**
   - 使用您的Simyo手机号和密码登录

2. **选择设备更换**
   - 登录成功后，选择"更换设备"选项

3. **完成设备更换流程**
   - **步骤2.1：申请新eSIM** - 通知Simyo系统您要更换设备
   - **步骤2.2：发送验证码（可选）** - 如果能接收短信则执行此步骤
   - **步骤2.3：确认验证码** - 输入收到的6位数字验证码

4. **获取eSIM配置**
   - 验证成功后自动进入eSIM获取步骤
   - 生成新的二维码供新设备使用

5. **新设备安装eSIM**
   - 在新设备上扫描生成的二维码
   - 或手动输入LPA激活码

6. **确认安装**
   - 使用"确认安装"功能验证eSIM状态
   - 确认成功后信号将很快恢复

#### 方式二：结合APP使用（传统方式）

1. **在Simyo APP中申请更换设备/eSIM**
   - 打开官方Simyo APP
   - 选择"更换设备"或"申请eSIM"
   - 填写收到的验证码
   - **进入下一界面后停留，不要继续操作**

2. **使用本工具生成二维码**
   - 重新登录您的Simyo账户
   - 选择"直接获取eSIM"
   - 生成新的二维码

3. **新设备安装eSIM**
   - 在新设备上扫描生成的二维码
   - 或手动输入LPA激活码
   - 启用安装完成的Simyo配置

4. **确认安装（推荐）**
   - 使用本工具的"确认安装"功能
   - 确认成功后信号将很快恢复

#### 验证码获取说明

- **能接收短信的情况**：执行步骤2.1后立即执行步骤2.2，验证码将发送到您的手机
- **无法接收短信的情况**：只执行步骤2.1，然后联系Simyo客服索要"更换eSIM设备时的验证码"
  - 客服可能需要您提供：号码、姓名、生日、地址、邮编
  - 请提前准备好这些信息，可在Simyo APP中查找

## 💰 保号服务

Simyo提供低成本保号服务，详细信息：

- **收款人**: ING BANK N.V.
- **IBAN**: `NL19INGB0007811670`
- **金额**: 0.01欧元
- **备注**: 您的Simyo号码（06开头的完整号码）

## ⚠️ 重要提示

### 使用注意事项
- **荷兰号码专用** - 仅适用于Simyo NL（荷兰）的用户
- **手机号格式** - 必须是06开头的10位数字
- **eSIM设备要求** - 确保您的设备支持eSIM功能
- **网络连接** - 需要稳定的网络连接进行API调用

### 设备更换特别说明
- 更换设备时请严格按照流程操作
- 在APP中申请后不要继续操作，立即使用本工具
- 非原生eSIM设备需要发送`install`和`enabled`通知

### 系统要求
- **现代浏览器** - Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **HTTPS环境** - 由于安全限制，某些功能需要HTTPS
- **JavaScript启用** - 必须启用JavaScript才能正常工作

## 🧪 测试

使用 `test_simyo_esim.html` 进行功能测试：

### 测试类别
1. **单元测试** - 手机号验证、API请求头生成、LPA格式、UI组件
2. **集成测试** - 登录流程、eSIM获取、二维码生成、安装确认
3. **端到端测试** - 完整流程、错误处理、设备更换场景
4. **性能测试** - API响应时间、内存使用监控

### 运行测试
1. 打开 `test_simyo_esim.html`
2. 配置模拟数据（可选）
3. 点击"运行所有测试"或选择特定测试类别
4. 查看测试结果和详细日志

## 📝 开发说明

### 核心组件架构
```javascript
// 全局状态管理
const appState = {
    sessionToken: "",      // Simyo会话令牌
    activationCode: "",    // eSIM激活码
    phoneNumber: "",       // 用户手机号
    password: "",          // 用户密码
    currentStep: 1         // 当前步骤
};
```

### 主要函数说明
- `mockValidatePhoneNumber()` - 验证荷兰手机号格式
- `createHeaders()` - 生成Simyo API请求头
- `showSection(stepNumber)` - 显示指定步骤
- `showStatus(element, message, type)` - 显示状态信息
- `generateQRCode(data)` - 生成eSIM二维码

### API调用示例
```javascript
// 登录Simyo账户
const response = await fetch('https://appapi.simyo.nl/simyoapi/api/v1/sessions', {
    method: 'POST',
    headers: createHeaders(false),
    body: JSON.stringify({
        phoneNumber: '0613715742',
        password: 'your_password'
    })
});

// 获取eSIM信息
const esimResponse = await fetch('https://appapi.simyo.nl/simyoapi/api/v1/esim/get-by-customer', {
    method: 'GET',
    headers: createHeaders(true) // 包含会话令牌
});
```

## 🔄 与Giffgaff工具的差异

| 特性 | Simyo eSIM | Giffgaff eSIM |
|------|------------|---------------|
| **认证方式** | 用户名密码登录 | OAuth 2.0 PKCE |
| **MFA验证** | 无需额外验证 | 邮件验证码 |
| **API复杂度** | 相对简单 | GraphQL + REST |
| **步骤数量** | 4步流程 | 5步流程 |
| **设备更换** | 支持专门流程 | 通过SIM交换 |
| **保号成本** | 0.01欧元 | 按正常套餐 |

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

## 🔗 相关资源

- [Simyo官方网站](https://www.simyo.nl/)
- [eSIM技术说明](https://en.wikipedia.org/wiki/ESIM)
- [荷兰移动号码格式](https://en.wikipedia.org/wiki/Telephone_numbers_in_the_Netherlands)

## 📄 许可证

本项目基于原始Simyo Postman脚本开发，仅供学习和个人使用。请遵守Simyo的服务条款和API使用政策。

## 🙋‍♂️ 支持

如有问题或建议，请：
1. 首先使用测试页面验证功能
2. 检查浏览器控制台错误信息
3. 确认网络连接和API可用性
4. 查阅Simyo官方文档

---

**免责声明**: 此工具仅为方便用户使用而开发，使用前请确保了解eSIM转换的风险和后果。开发者不对因使用此工具造成的任何损失承担责任。请确保您有权使用相关的Simyo账户和服务。