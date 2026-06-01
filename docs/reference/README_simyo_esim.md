# Simyo NL eSIM 工具 - 技术参考

> 基于 Simyo ESIM V2.postman_collection.json Postman 脚本构建的完整 eSIM 设备更换网页工具。

## 📁 文件说明

### 主要文件
- **`src/simyo/simyo_modular.html`** - Simyo eSIM 设备更换工具（生产版本，模块化架构）
- **`tests/test_simyo_esim.html`** - 综合测试页面（开发/测试版本）

## 🔧 技术架构

### 前端技术栈
- **HTML5** - 语义化结构
- **CSS3** - 响应式设计，Bootstrap 5.3.0，Simyo 品牌配色
- **JavaScript (ES6+)** - 现代 JavaScript 特性
- **Font Awesome 6.0.0** - 图标库

### API 集成
- **Simyo Sessions API** - 用户认证和会话管理
- **Simyo eSIM API** - eSIM 配置获取和管理
- **QR Code API** - 二维码生成服务，三级回退链：`qrcode.show` → `quickchart.io` → `api.qrserver.com`，单服务 5 秒超时，全部失败时显示 LPA 字符串供用户手动复制

### 关键 API 端点
```javascript
const apiEndpoints = {
    login: "https://appapi.simyo.nl/simyoapi/api/v1/sessions",
    getEsim: "https://appapi.simyo.nl/simyoapi/api/v1/esim/get-by-customer",
    confirmInstall: "https://appapi.simyo.nl/simyoapi/api/v1/esim/reorder-profile-installed",
    qrcode: "https://qrcode.show/"
};
```

## 💰 保号服务

Simyo 提供保号服务，详细信息：

- **收款人**: ING BANK N.V.
- **IBAN**: `NL19INGB0007811670`
- **金额**: 10 欧元起
- **备注**: 您的 Simyo 号码（06 开头的完整号码）

## 📝 开发说明

### 核心组件架构
```javascript
// 全局状态管理
const appState = {
    sessionToken: "",      // Simyo 会话令牌
    activationCode: "",    // eSIM 激活码
    phoneNumber: "",       // 用户手机号
    password: "",          // 用户密码
    currentStep: 1         // 当前步骤
};
```

### 主要函数说明
- `mockValidatePhoneNumber()` - 验证荷兰手机号格式
- `createHeaders()` - 生成 Simyo API 请求头
- `showSection(stepNumber)` - 显示指定步骤
- `showStatus(element, message, type)` - 显示状态信息
- `generateQRCode(data)` - 生成 eSIM 二维码，内部维护三级服务商回退链（`qrcode.show` → `quickchart.io` → `api.qrserver.com`），每个服务商 5 秒超时，回退时重置计时器，全部失败时展示 LPA 字符串供用户手动复制

### API 调用示例
```javascript
// 登录 Simyo 账户
const response = await fetch('https://appapi.simyo.nl/simyoapi/api/v1/sessions', {
    method: 'POST',
    headers: createHeaders(false),
    body: JSON.stringify({
        phoneNumber: '0613123712',
        password: 'your_password'
    })
});

// 获取 eSIM 信息
const esimResponse = await fetch('https://appapi.simyo.nl/simyoapi/api/v1/esim/get-by-customer', {
    method: 'GET',
    headers: createHeaders(true) // 包含会话令牌
});
```

## 🔄 与 Giffgaff 工具的差异

| 特性 | Simyo eSIM | Giffgaff eSIM |
|------|------------|---------------|
| **认证方式** | 用户名密码登录 | OAuth 2.0 PKCE |
| **MFA 验证** | 无需额外验证 | 邮件验证码 |
| **API 复杂度** | 相对简单 | GraphQL + REST |
| **步骤数量** | 4 步流程 | 5 步流程 |
| **设备更换** | 支持专门流程 | 通过 SIM 交换 |
| **保号成本** | 10 欧元起 | 按正常套餐 |

---

**文档版本：** 1.1.0
**最后更新：** 2026-05-18
**维护者：** eSIM Tools Team
