# 安全指南

## 概述

本项目实施了多层安全措施来保护用户数据和系统安全。

## 安全措施

### 1. 依赖包安全

#### 定期更新
- 使用 `npm update` 定期更新所有依赖包
- 使用 `npm audit` 检查安全漏洞
- 使用 `npm run security-check` 运行自定义安全检查

#### 已知漏洞修复
- ✅ tar-fs: 路径遍历漏洞已修复
- ✅ got: UNIX socket重定向漏洞已修复
- ✅ ipx: 路径遍历绕过漏洞已修复
- ✅ http-proxy-middleware: writeBody重复调用漏洞已修复
- ✅ esbuild: 开发服务器安全问题已修复
- ✅ on-headers: HTTP响应头操作漏洞已修复

### 2. 服务器安全

#### Helmet安全头
```javascript
const helmet = require('helmet');
app.use(helmet());
```

#### CORS配置
```javascript
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://esim.cosr.eu.org';
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // 非浏览器/本地文件放行
    if (origin === ALLOWED_ORIGIN) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: false
}));
```

> 生产环境通过 Netlify Functions 的 `withAuth` 中间件统一处理 CORS，`ALLOWED_ORIGIN` 从环境变量读取。

### 3. 内容安全策略 (CSP)

所有 HTML 文件都配置了严格的 CSP 策略。本地开发服务器 (`server.js`) 中的 Helmet 配置如下：

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://qrcode.show", "https://api.qrserver.com", "https://appapi.simyo.nl", "https://api.giffgaff.com", "https://id.giffgaff.com", "https://publicapi.giffgaff.com", "https://cdn.jsdelivr.net", "https://*.sentry.io"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"]
    }
  }
}));
```

> 生产环境的 HTML `<meta>` 标签中也配置了 CSP，具体值可能略有差异，请以 `server.js` 中的 Helmet 配置为参考基准。

### 4. 数据安全

#### 本地存储
- 敏感数据不存储在服务器上
- 使用LocalStorage进行会话持久化
- 2小时自动过期机制

#### API安全
- 所有API请求通过Netlify Functions代理
- 不直接暴露用户凭据
- 使用HTTPS进行所有通信

### 5. 部署安全

#### HTTPS强制
- 所有生产环境强制使用HTTPS
- 自动重定向HTTP到HTTPS

#### 环境变量
- 敏感配置使用环境变量
- 不在代码中硬编码密钥

## 安全最佳实践

### 开发环境
1. **定期更新依赖**
   ```bash
   npm update
   npm audit fix
   ```

2. **运行安全检查**
   ```bash
   npm run security-check
   ```

3. **代码审查**
   - 检查第三方库的使用
   - 验证API调用的安全性
   - 确保没有硬编码的敏感信息

### 生产环境
1. **HTTPS部署**
   - 使用有效的SSL证书
   - 配置HSTS头

2. **监控和日志**
   - 监控异常访问模式
   - 记录安全相关事件

3. **定期安全审计**
   - 使用自动化工具检查漏洞
   - 定期审查访问日志

## 安全响应

### 发现漏洞时
1. 立即评估漏洞严重程度
2. 在24小时内发布修复
3. 通知相关用户
4. 更新安全文档

### 报告安全问题
- 通过GitHub Issues报告
- 提供详细的复现步骤
- 包含环境信息

## 安全检查清单

### 开发前
- [ ] 运行 `npm audit`
- [ ] 检查依赖包版本
- [ ] 验证CSP配置

### 部署前
- [ ] 运行 `npm run security-check`
- [ ] 验证HTTPS配置
- [ ] 检查环境变量

### 定期检查
- [ ] 更新依赖包
- [ ] 审查访问日志
- [ ] 检查安全配置

## 安全工具

### 内置工具
- `npm run security-check`: 自定义安全检查
- `npm audit`: npm安全审计
- `npm update`: 更新依赖包

### 推荐工具
- [Snyk](https://snyk.io/): 依赖漏洞扫描
- [OWASP ZAP](https://owasp.org/www-project-zap/): Web应用安全测试
- [Security Headers](https://securityheaders.com/): 安全头检查

## 安全联系

如果您发现安全问题，请：
1. 通过GitHub Issues报告
2. 提供详细的描述和复现步骤
3. 不要公开披露，等待修复

## 免责声明

本安全指南提供了基本的安全措施，但不能保证100%的安全性。建议根据具体需求进行额外的安全评估。 