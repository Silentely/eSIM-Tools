# Giffgaff CSP和OAuth回调问题修复

## 🔍 问题描述

用户在使用Giffgaff eSIM工具时遇到两个关键问题：

### 1. CSP (Content Security Policy) 违规
```
Refused to connect to 'https://id.giffgaff.com/auth/oauth/token' because it violates the following Content Security Policy directive: "connect-src 'self' https://api.qrserver.com https://appapi.simyo.nl https://api.giffgaff.com".
```

### 2. OAuth回调URL处理问题
- 系统返回了 `giffgaff://auth/callback/?code=...&state=...` 格式的回调URL
- 原有代码只支持标准HTTP/HTTPS URL格式解析

## 🛠️ 修复方案

### 1. 修复CSP配置

**问题原因**: CSP的 `connect-src` 指令中缺少 `https://id.giffgaff.com` 域名

**修复方案**: 添加完整的CSP配置，包含所有必要的Giffgaff域名

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;
  font-src 'self' https://cdnjs.cloudflare.com;
  connect-src 'self'
    https://qrcode.show
    https://api.qrserver.com
    https://appapi.simyo.nl
    https://api.giffgaff.com
    https://id.giffgaff.com           ← 新增
    https://publicapi.giffgaff.com;   ← 新增
  img-src 'self' data: https:;
  frame-src 'none';
">
```

### 2. 修复OAuth回调URL解析

**问题原因**: 原有代码只能处理标准HTTP/HTTPS URL，无法解析 `giffgaff://` 协议

**修复前代码**:
```javascript
const url = new URL(callbackUrl);
const code = url.searchParams.get('code');
```

**修复后代码**:
```javascript
let code, state;

if (callbackUrl.startsWith('giffgaff://')) {
    // 处理giffgaff://协议的回调URL
    const match = callbackUrl.match(/[?&]code=([^&]+)/);
    const stateMatch = callbackUrl.match(/[?&]state=([^&]+)/);
    code = match ? decodeURIComponent(match[1]) : null;
    state = stateMatch ? decodeURIComponent(stateMatch[1]) : null;
} else {
    // 处理标准HTTP/HTTPS URL
    const url = new URL(callbackUrl);
    code = url.searchParams.get('code');
    state = url.searchParams.get('state');
}
```

### 3. 改进用户界面

**增加了回调URL格式说明**:
```html
<div class="alert alert-info mb-4">
    <h6><i class="fas fa-info-circle me-2"></i>回调URL格式说明：</h6>
    <p class="mb-2"><strong>支持的格式：</strong></p>
    <ul class="mb-2">
        <li><code>giffgaff://auth/callback/?code=...&state=...</code></li>
        <li><code>https://example.com/callback?code=...&state=...</code></li>
    </ul>
    <p class="mb-0"><small class="text-muted">请复制包含 <code>code</code> 参数的完整URL</small></p>
</div>
```

## 📋 修复的文件

### `giffgaff_modular.html`

1. **CSP配置** (第6行)
   - 添加了完整的Content Security Policy
   - 包含所有必要的Giffgaff域名

2. **OAuth回调解析** (第817-837行)
   - 支持 `giffgaff://` 协议URL解析
   - 支持标准HTTP/HTTPS URL解析
   - 添加了调试日志输出

3. **用户界面** (第470-478行)
   - 添加了回调URL格式说明
   - 更新了占位符文本
   - 提供了具体的示例

## 🔄 OAuth认证流程

```
1. 用户点击"开始OAuth登录"
   ↓
2. 打开Giffgaff登录页面
   ↓
3. 用户输入邮箱验证码完成登录
   ↓
4. 系统重定向到: giffgaff://auth/callback/?code=...&state=...
   ↓
5. 用户复制完整回调URL到工具中
   ↓
6. 工具解析回调URL提取code和state
   ↓
7. 使用code交换access_token
   ↓
8. 继续后续的MFA和GraphQL流程
```

## 🧪 测试步骤

### 1. CSP测试
1. 打开浏览器开发者工具的控制台
2. 点击"开始OAuth登录"
3. 确认没有CSP违规错误

### 2. 回调URL测试
1. 完成OAuth登录流程
2. 复制回调URL: `giffgaff://auth/callback/?code=EDXgE_Uq5Q96LT5s&state=7piz0IXfUIHHoxMURfaboQ`
3. 粘贴到回调URL输入框
4. 点击"处理回调"
5. 检查控制台确认解析成功

### 预期结果
- ✅ 无CSP违规错误
- ✅ 成功解析giffgaff://协议URL
- ✅ 控制台显示解析到的code和state
- ✅ 成功交换access_token

## 🔧 调试技巧

### 浏览器控制台检查
```javascript
// 检查CSP是否允许连接
console.log('Testing CSP for id.giffgaff.com...');

// 检查回调URL解析
console.log('解析到的授权码:', code);
console.log('解析到的状态:', state);
```

### 常见问题排查

1. **CSP错误持续出现**
   - 确认浏览器已刷新页面
   - 检查meta标签是否正确添加

2. **回调URL解析失败**
   - 确认URL包含code参数
   - 检查URL格式是否正确
   - 查看控制台的调试输出

3. **OAuth token交换失败**
   - 确认code未过期（通常有效期很短）
   - 检查state参数是否匹配
   - 查看网络请求的详细错误

## ✅ 修复确认

经过修复后，Giffgaff eSIM工具应该能够：
- ✅ 无CSP违规错误地访问所有Giffgaff API
- ✅ 正确解析 `giffgaff://` 协议的回调URL
- ✅ 成功完成OAuth token交换
- ✅ 继续执行后续的MFA和GraphQL流程

---

**注意**:
1. 如果仍有问题，请检查浏览器控制台的详细错误信息
2. OAuth授权码有时间限制，需要及时处理回调
3. 确保复制的回调URL完整且未被截断
