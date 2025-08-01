# eSIM工具部署指南

## 🌐 Netlify静态部署

### 部署准备

1. **文件结构确认**
   ```
   esim/
   ├── index.html                    # 主页面（工具选择）
   ├── giffgaff_complete_esim.html   # Giffgaff工具
   ├── simyo_complete_esim.html      # Simyo工具（含代理API调用）
   ├── simyo_static.html             # Simyo静态版本（演示用）
   ├── netlify.toml                  # Netlify配置文件
   └── 其他资源文件...
   ```

2. **域名路由配置**
   - `esim.yyxx.com/` → 主页面选择工具
   - `esim.yyxx.com/giffgaff` → Giffgaff eSIM工具
   - `esim.yyxx.com/simyo` → Simyo eSIM工具

### Netlify部署步骤

#### 方式一：Git连接部署（推荐）

1. **准备Git仓库**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: eSIM Tools"
   git remote add origin https://github.com/your-username/esim-tools.git
   git push -u origin main
   ```

2. **Netlify部署**
   - 登录 [Netlify](https://app.netlify.com)
   - 点击 "New site from Git"
   - 选择GitHub/GitLab/Bitbucket
   - 选择您的仓库
   - 构建设置：
     - Build command: `echo 'No build needed'`
     - Publish directory: `.`
   - 点击 "Deploy site"

3. **自定义域名**
   - 在Netlify站点设置中
   - Domain management → Add custom domain
   - 输入 `esim.yyxx.com`
   - 配置DNS记录指向Netlify

#### 方式二：手动上传部署

1. **准备文件**
   - 将所有HTML文件和资源文件打包
   - 确保包含 `netlify.toml` 配置文件

2. **Netlify手动部署**
   - 登录 Netlify
   - 拖拽文件夹到部署区域
   - 等待部署完成

### 自定义域名DNS配置

如果您使用 `esim.yyxx.com` 域名：

```dns
# A记录或CNAME记录
esim.yyxx.com  CNAME  your-site-name.netlify.app
```

## ⚠️ 静态部署限制

### CORS问题说明

**问题**：浏览器安全策略阻止静态网站直接调用第三方API

**影响**：
- Simyo API调用会被CORS策略阻止
- Giffgaff API调用可能也会受到影响

**解决方案**：

#### 1. Netlify代理重定向（推荐）
已在 `netlify.toml` 中配置：
```toml
[[redirects]]
  from = "/api/simyo/*"
  to = "https://appapi.simyo.nl/simyoapi/api/v1/:splat"
  status = 200
  force = true
```

**使用方法**：
- 前端调用 `/api/simyo/sessions` 而不是直接调用Simyo API
- Netlify会自动代理到实际的API端点

#### 2. 浏览器插件方案
**Chrome用户**：
- 安装 "CORS Unblock" 或 "CORS Everywhere" 插件
- 启用插件后刷新页面

**Firefox用户**：
- 安装 "CORS Everywhere" 插件
- 在插件设置中启用跨域请求

#### 3. 浏览器启动参数方案
**Chrome（开发测试用）**：
```bash
# Windows
chrome.exe --user-data-dir=/tmp/chrome_dev --disable-web-security

# macOS
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir=/tmp/chrome_dev --disable-web-security

# Linux
google-chrome --user-data-dir=/tmp/chrome_dev --disable-web-security
```

⚠️ **安全警告**：方案2和3会降低浏览器安全性，仅建议在开发测试时使用。

## 🚀 完整功能部署（Node.js）

如果您需要完整的API代理功能，建议使用以下平台：

### Heroku部署

1. **准备 `package.json`**
   ```json
   {
     "name": "esim-tools",
     "version": "1.0.0",
     "scripts": {
       "start": "node simyo_proxy_server.js"
     },
     "dependencies": {
       "express": "^4.18.2",
       "cors": "^2.8.5",
       "node-fetch": "^2.7.0"
     }
   }
   ```

2. **Heroku部署**
   ```bash
   heroku create your-esim-tools
   git push heroku main
   ```

### Railway部署

1. **连接GitHub仓库**
2. **设置环境变量**
   - `PORT`: 自动设置
3. **部署完成**

### Vercel部署（Serverless）

1. **安装Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **部署**
   ```bash
   vercel --prod
   ```

## 📋 部署检查清单

### 部署前检查
- [ ] 所有HTML文件语法正确
- [ ] `netlify.toml` 配置文件存在
- [ ] 路由重定向规则配置正确
- [ ] 开卡推广链接已添加
- [ ] CORS解决方案说明已添加

### 部署后验证
- [ ] 主页面 `/` 正常访问
- [ ] Giffgaff工具 `/giffgaff` 正常跳转
- [ ] Simyo工具 `/simyo` 正常跳转
- [ ] 自定义域名解析正确
- [ ] HTTPS证书自动配置
- [ ] 移动端响应式布局正常

### 功能测试
- [ ] 页面加载速度正常
- [ ] 表单输入验证工作
- [ ] 错误提示显示正确
- [ ] 外部链接（开卡链接）正常
- [ ] API调用错误提示清晰

## 🔧 故障排除

### 常见问题

1. **404错误**
   - 检查 `netlify.toml` 重定向配置
   - 确认文件路径正确

2. **CORS错误**
   - 确认Netlify代理配置
   - 检查API端点路径

3. **样式/脚本加载失败**
   - 检查CDN链接可用性
   - 确认相对路径正确

4. **自定义域名不工作**
   - 验证DNS记录配置
   - 检查域名解析状态

### 调试技巧

1. **使用浏览器开发者工具**
   - Network标签查看请求状态
   - Console标签查看JavaScript错误

2. **Netlify部署日志**
   - 查看构建和部署日志
   - 检查重定向规则是否生效

3. **测试API代理**
   ```javascript
   // 在浏览器控制台测试
   fetch('/api/simyo/sessions', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({phoneNumber: '0612345678', password: 'test'})
   }).then(r => r.json()).then(console.log);
   ```

## 📊 性能优化

### 建议优化项
- [ ] 启用Gzip压缩
- [ ] 配置缓存策略
- [ ] 优化图片资源
- [ ] 压缩CSS/JS文件
- [ ] 使用CDN加速

### Netlify性能配置
```toml
# netlify.toml 中添加
[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000"

[[headers]]
  for = "*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000"
```

---

**总结**：Netlify静态部署是最简单的方案，但受CORS限制。通过配置代理重定向和提供用户指导，可以实现良好的用户体验。如需完整功能，建议使用支持Node.js的平台部署。