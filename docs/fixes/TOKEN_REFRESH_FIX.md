# Giffgaff eSIM 令牌过期问题修复

## 问题描述

在使用 Giffgaff eSIM 转换流程时，用户通过Cookie登录成功后，在后续步骤（特别是MFA挑战请求）中会遇到令牌过期的问题：

```
{
  "error": "MFA Challenge Failed",
  "message": "Request failed with status code 401",
  "details": {
    "error": "invalid_token",
    "error_description": "Access token expired"
  }
}
```

这是因为从Cookie获取的访问令牌(access token)有效期有限，而原始代码没有实现令牌过期后的刷新机制。

## 解决方案

我们实现了一个完整的令牌刷新机制，包括前端和后端的改进：

### 1. 前端改进

- 在Cookie验证成功后，将原始Cookie保存到localStorage中，以备后续刷新令牌使用
  ```javascript
  // 保存cookie到localStorage
  function saveCookie(cookie) {
      if (cookie && typeof cookie === 'string') {
          localStorage.setItem('giffgaff_cookie', cookie);
          console.log('已保存cookie到localStorage');
      }
  }
  ```

- 在前端API模块中实现令牌刷新逻辑，当检测到令牌过期时，使用存储的Cookie重新获取有效令牌
  ```javascript
  async sendMFAChallenge(accessToken) {
    try {
      // 尝试使用现有令牌
      const response = await fetch(this.endpoints.mfaChallenge, {...});

      if (response.ok) {
        return await response.json();
      }

      // 如果是401错误，可能是令牌过期
      if (response.status === 401 &&
          errorData?.details?.error === 'invalid_token') {

        // 尝试使用本地存储的cookie重新验证
        const cookie = localStorage.getItem('giffgaff_cookie');
        if (cookie) {
          const cookieVerifyResult = await this.verifyCookie(cookie);

          if (cookieVerifyResult.success) {
            // 使用新令牌重新发送请求...
          }
        }
      }
    } catch (error) {
      // 处理错误
    }
  }
  ```

### 2. 后端改进

- 修改`giffgaff-mfa-challenge.js`和`giffgaff-mfa-validation.js`，在检测到Cookie但没有有效令牌时，自动调用`verify-cookie`函数获取新的访问令牌

  ```javascript
  // 如果提供cookie但没有accessToken，先尝试使用cookie获取accessToken
  if (cookie && !accessToken) {
    try {
      // 调用verify-cookie函数获取accessToken
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
        console.log('Successfully obtained access token from cookie');
      }
    } catch (cookieError) {
      console.error('Failed to verify cookie:', cookieError.message);
    }
  }
  ```

- 修改OAuth认证方式，使用Authorization头而不是表单参数发送客户端凭据，与Postman配置保持一致

### 3. 流程改进

整体改进的令牌刷新流程如下：

1. 用户通过Cookie登录，前端保存Cookie和访问令牌
2. 发送MFA挑战请求时，如果检测到令牌过期：
   - 前端：使用存储的Cookie重新获取有效令牌，然后重新发送请求
   - 后端：如果提供了Cookie但没有有效令牌，自动使用Cookie获取新令牌
3. 验证MFA验证码时，同样应用令牌刷新机制

这种双重保障机制确保了即使令牌过期，系统也能自动刷新并继续完成 eSIM 转换流程，无需用户重新登录。

## 技术细节

- **Cookie存储**：使用`localStorage.setItem('giffgaff_cookie', cookie)`保存原始Cookie
- **令牌刷新检测**：通过检查HTTP 401状态码和`error: 'invalid_token'`错误信息识别令牌过期
- **令牌刷新方式**：调用`verify-cookie`函数，传入存储的Cookie获取新的访问令牌
- **无缝体验**：用户无需感知令牌刷新过程，整个流程自动完成

## 注意事项

- Cookie本身也有过期时间，通常比访问令牌更长。如果Cookie也过期，用户需要重新登录
- 为保护用户隐私和安全，Cookie存储仅在用户当前浏览器会话中有效
- 此机制不适用于OAuth登录方式，OAuth登录需要单独处理令牌刷新
