# Giffgaff eSIM 工具 - 技术参考

> 基于 Giffgaff-swap-esim.json Postman 脚本构建的完整 eSIM 设备更换网页工具。

## 📁 文件说明

### 主要文件
- **`src/giffgaff/giffgaff_modular.html`** - eSIM 设备更换工具（生产版本，模块化架构）
- **`tests/test_giffgaff_esim.html`** - 综合测试页面（开发/测试版本）

### 参考文件
- **`postman/giffgaff.html`** - 原始单文件版本（参考）
- **`postman/Giffgaff-swap-esim.json`** - 原始 Postman 脚本

## 🔧 技术架构

### 前端技术栈
- **HTML5** - 语义化结构
- **CSS3** - 响应式设计，Bootstrap 5.3.0
- **JavaScript (ES6+)** - 现代 JavaScript 特性
- **Font Awesome 6.0.0** - 图标库

### API 集成
- **OAuth 2.0 PKCE** - 安全认证流程
- **Giffgaff ID API** - 用户认证和 MFA
- **Giffgaff GraphQL API** - 业务逻辑处理
- **QR Code API** - 二维码生成服务（优先 `https://qrcode.show/`，备选 `quickchart.io` 与 `chart.googleapis.com`）

### 关键 API 端点
```javascript
const apiEndpoints = {
    mfaChallenge: "https://id.giffgaff.com/v4/mfa/challenge/me",
    mfaValidation: "https://id.giffgaff.com/v4/mfa/validation",
    graphql: "https://publicapi.giffgaff.com/gateway/graphql",
    qrcode: "https://qrcode.show/"
};
```

## 📝 开发说明

### 核心组件架构
```javascript
// 全局状态管理
const appState = {
    accessToken: "",      // OAuth 访问令牌
    codeVerifier: "",     // PKCE 代码验证器
    emailCodeRef: "",     // 邮件验证引用
    emailSignature: "",   // MFA 签名
    memberId: "",         // 会员 ID
    esimSSN: "",         // eSIM 序列号
    lpaString: "",        // LPA 下载字符串
    currentStep: 1        // 当前步骤
};
```

### 主要函数说明
- `generateCodeVerifier()` - 生成 PKCE 代码验证器
- `generateCodeChallenge()` - 生成 PKCE 代码挑战
- `showSection(stepNumber)` - 显示指定步骤
- `showStatus(element, message, type)` - 显示状态信息
- `generateQRCode(data)` - 生成二维码

### GraphQL 查询示例
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

# 预订 eSIM
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

---

**文档版本：** 1.1.0
**最后更新：** 2026-05-18
**维护者：** eSIM Tools Team
