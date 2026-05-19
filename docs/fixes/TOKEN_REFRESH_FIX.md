# Giffgaff eSIM 令牌过期问题修复

## 🔍 问题描述

在使用 Giffgaff eSIM 转换流程时，用户通过 Cookie 登录成功后，在后续步骤（特别是 MFA 挑战请求）中会遇到令牌过期的问题：

```json
{
  "error": "MFA Challenge Failed",
  "message": "Request failed with status code 401",
  "details": {
    "error": "invalid_token",
    "error_description": "Access token expired"
  }
}
```

**根本原因**: 从 Cookie 获取的访问令牌 (access token) 有效期有限，原始代码没有实现令牌过期后的刷新机制。

## 🛠️ 修复方案

### 1. 前端改进

在 Cookie 验证成功后，将原始 Cookie 保存到 localStorage 以备后续刷新令牌使用：

```javascript
// 保存 cookie 到 localStorage
function saveCookie(cookie) {
    if (cookie && typeof cookie === 'string') {
        localStorage.setItem('giffgaff_cookie', cookie);
    }
}
```

在前端 API 模块中实现令牌刷新逻辑，当检测到令牌过期时，使用存储的 Cookie 重新获取有效令牌：

```javascript
async sendMFAChallenge(accessToken) {
  try {
    const response = await fetch(this.endpoints.mfaChallenge, {...});

    if (response.ok) {
      return await response.json();
    }

    // 如果是 401 错误，可能是令牌过期
    if (response.status === 401) {
      const errorData = await response.json();
      if (errorData?.details?.error === 'invalid_token') {
        // 尝试使用本地存储的 cookie 重新验证
        const cookie = localStorage.getItem('giffgaff_cookie');
        if (cookie) {
          const cookieVerifyResult = await this.verifyCookie(cookie);
          if (cookieVerifyResult.success) {
            // 使用新令牌重新发送请求...
          }
        }
      }
    }
  } catch (error) {
    // 处理错误
  }
}
```

### 2. 后端改进

修改 `giffgaff-mfa-challenge.js` 和 `giffgaff-mfa-validation.js`，在检测到 Cookie 但没有有效令牌时，自动调用 `verify-cookie` 函数获取新的访问令牌：

```javascript
// 如果提供 cookie 但没有 accessToken，先尝试使用 cookie 获取 accessToken
if (cookie && !accessToken) {
  try {
    const cookieVerifyResponse = await axios.post(
      'https://esim.cosr.eu.org/.netlify/functions/verify-cookie',
      { cookie },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    if (cookieVerifyResponse.data && cookieVerifyResponse.data.success) {
      accessToken = cookieVerifyResponse.data.accessToken;
    }
  } catch (cookieError) {
    console.error('Failed to verify cookie:', cookieError.message);
  }
}
```

同时修改 OAuth 认证方式，使用 Authorization 头而不是表单参数发送客户端凭据，与 Postman 配置保持一致。

### 3. 改进后的流程

1. 用户通过 Cookie 登录，前端保存 Cookie 和访问令牌
2. 发送 MFA 挑战请求时，如果检测到令牌过期：
   - **前端**: 使用存储的 Cookie 重新获取有效令牌，然后重新发送请求
   - **后端**: 如果提供了 Cookie 但没有有效令牌，自动使用 Cookie 获取新令牌
3. 验证 MFA 验证码时，同样应用令牌刷新机制

这种双重保障机制确保了即使令牌过期，系统也能自动刷新并继续完成 eSIM 转换流程，无需用户重新登录。

## 🧪 技术细节

- **Cookie 存储**: 使用 `localStorage.setItem('giffgaff_cookie', cookie)` 保存原始 Cookie
- **令牌刷新检测**: 通过检查 HTTP 401 状态码和 `error: 'invalid_token'` 错误信息识别令牌过期
- **令牌刷新方式**: 调用 `verify-cookie` 函数，传入存储的 Cookie 获取新的访问令牌
- **无缝体验**: 用户无需感知令牌刷新过程，整个流程自动完成

## ⚠️ 注意事项

- Cookie 本身也有过期时间，通常比访问令牌更长。如果 Cookie 也过期，用户需要重新登录
- Cookie 存储仅在用户当前浏览器会话中有效
- 此机制不适用于 OAuth 登录方式，OAuth 登录需要单独处理令牌刷新
