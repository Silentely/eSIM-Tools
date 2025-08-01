# 🚀 双版本部署指南

本项目支持两个独立版本的构建和部署：

## 📋 版本对比

| 特性 | 标准版本 | 安全版本 |
|------|----------|----------|
| **目标用户** | 开发者、学习者 | 企业用户、生产环境 |
| **源代码可见性** | ✅ 完全开源 | ❌ 高度混淆 |
| **敏感信息暴露** | ⚠️ 部分暴露 | ✅ 零暴露 |
| **防调试保护** | ❌ 无保护 | ✅ 多层保护 |
| **防爬虫机制** | ❌ 无保护 | ✅ 智能检测 |
| **安全头部** | 🔵 基础级别 | 🔴 企业级别 |
| **部署复杂度** | 🟢 简单 | 🟡 中等 |

## 🔧 本地构建

### 标准版本构建
```bash
# 构建标准版本
npm run build:standard

# 预览
npm run preview:standard

# 部署到生产
npm run deploy:standard
```

### 安全版本构建
```bash
# 构建安全版本
npm run build:secure

# 预览
npm run preview:secure

# 部署到生产
npm run deploy:secure
```

## 🌐 Netlify部署

### 方法一：CLI命令行部署

#### 标准版本部署
```bash
# 使用标准版本配置
netlify deploy --prod --config netlify-standard.toml

# 或使用构建脚本
npm run deploy:standard
```

#### 安全版本部署
```bash
# 使用安全版本配置
netlify deploy --prod --config netlify-secure.toml

# 或使用构建脚本
npm run deploy:secure
```

### 方法二：Netlify控制台手动部署

#### 🔓 标准版本手动部署

**步骤详解**：

1. **Fork仓库**
   - 访问 [GitHub仓库](https://github.com/Silentely/esim-tools)
   - 点击右上角 "Fork" 按钮
   - Fork到您的GitHub账户

2. **创建Netlify站点**
   - 登录 [Netlify控制台](https://app.netlify.com)
   - 点击 "New site from Git"
   - 选择 "GitHub" 并授权连接
   - 选择您Fork的 `esim-tools` 仓库

3. **配置构建设置**
   ```
   Repository: your-username/esim-tools
   Branch: main
   Build command: npm run build:standard
   Publish directory: dist-standard
   Functions directory: dist-standard/netlify/functions
   ```

4. **环境变量配置（可选）**
   ```
   NODE_ENV=production
   BUILD_VERSION=standard
   SECURITY_LEVEL=basic
   ```

5. **部署**
   - 点击 "Deploy site"
   - 等待构建完成
   - 获得类似 `https://amazing-site-123456.netlify.app` 的URL

#### 🔒 安全版本手动部署

**步骤详解**：

1. **Fork仓库**（同标准版本）

2. **创建Netlify站点**（同标准版本）

3. **配置构建设置**
   ```
   Repository: your-username/esim-tools
   Branch: main
   Build command: npm run build:secure
   Publish directory: dist-secure
   Functions directory: dist-secure/netlify/functions
   ```

4. **⚠️ 重要：环境变量配置**
   
   在 "Site settings" → "Environment variables" 中添加：
   
   **必需变量**：
   ```
   NODE_ENV=production
   BUILD_VERSION=secure
   SECURITY_LEVEL=enterprise
   SESSION_SECRET=your_32_character_secret_key_here
   ```
   
   **推荐变量**（提高安全性）：
   ```
   GIFFGAFF_CLIENT_SECRET=your_giffgaff_client_secret
   SIMYO_CLIENT_TOKEN=your_simyo_client_token
   GIFFGAFF_CLIENT_ID=your_giffgaff_client_id
   ```

5. **部署**
   - 点击 "Deploy site"
   - 等待构建完成
   - 验证安全功能正常工作

#### 📋 构建配置对比表

| 配置项 | 标准版本 | 安全版本 |
|--------|----------|----------|
| **Build command** | `npm run build:standard` | `npm run build:secure` |
| **Publish directory** | `dist-standard` | `dist-secure` |
| **Functions directory** | `dist-standard/netlify/functions` | `dist-secure/netlify/functions` |
| **环境变量** | 可选 | 必需 |
| **构建时间** | ~2分钟 | ~3分钟 |
| **构建大小** | ~15MB | ~18MB |

#### 🔧 高级手动配置

**使用自定义netlify.toml**：

如果您想使用项目中预设的配置文件：

1. **标准版本**：
   ```
   Build command: cp netlify-standard.toml netlify.toml && npm run build:standard
   Publish directory: dist-standard
   ```

2. **安全版本**：
   ```
   Build command: cp netlify-secure.toml netlify.toml && npm run build:secure
   Publish directory: dist-secure
   ```

**自定义域名配置**：

1. 在Netlify控制台进入 "Site settings" → "Domain management"
2. 点击 "Add custom domain"
3. 输入您的域名（如 `esim.yourdomain.com`）
4. 按照提示配置DNS记录

**SSL证书**：
- Netlify自动提供Let's Encrypt SSL证书
- 自定义域名会自动配置HTTPS

### 方法二：使用环境变量

在Netlify控制台中设置环境变量：

#### 标准版本环境变量
```bash
BUILD_VERSION=standard
SECURITY_LEVEL=basic
```

#### 安全版本环境变量
```bash
BUILD_VERSION=secure
SECURITY_LEVEL=enterprise
```

### 方法三：使用不同的分支

```bash
# 创建分支
git checkout -b production-standard
git checkout -b production-secure

# 在不同分支中使用不同的netlify.toml
cp netlify-standard.toml netlify.toml  # 标准版本分支
cp netlify-secure.toml netlify.toml   # 安全版本分支
```

## 🔄 CI/CD集成

### GitHub Actions示例

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy Multiple Versions

on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true
        default: 'standard'
        type: choice
        options:
        - standard
        - secure

jobs:
  deploy-standard:
    if: github.event.inputs.version == 'standard' || github.event.inputs.version == ''
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run build:standard
    - name: Deploy to Netlify
      uses: netlify/actions/cli@master
      with:
        args: deploy --prod --dir dist-standard --functions dist-standard/netlify/functions
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

  deploy-secure:
    if: github.event.inputs.version == 'secure'
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run build:secure
    - name: Deploy to Netlify
      uses: netlify/actions/cli@master
      with:
        args: deploy --prod --dir dist-secure --functions dist-secure/netlify/functions
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID_SECURE }}
```

## 🌍 多站点部署策略

### 策略一：不同域名
- **标准版本**: `esim-standard.cosr.eu.org`
- **安全版本**: `esim-secure.cosr.eu.org`

### 策略二：子路径部署
- **标准版本**: `esim.cosr.eu.org/standard/`
- **安全版本**: `esim.cosr.eu.org/secure/`

### 策略三：不同Netlify站点
1. 创建两个独立的Netlify站点
2. 使用不同的仓库分支或配置
3. 独立管理和部署

## 📁 构建产物结构

### 标准版本 (`dist-standard/`)
```
dist-standard/
├── index.html                 # 标准版本主页
├── src/
│   ├── giffgaff/
│   │   └── giffgaff_complete_esim.html
│   └── simyo/
│       └── simyo_complete_esim.html
├── netlify/
│   └── functions/             # 标准Functions
├── netlify.toml              # 标准配置
└── build-info.json          # 构建信息
```

### 安全版本 (`dist-secure/`)
```
dist-secure/
├── index.html                 # 安全版本主页
├── src/
│   ├── giffgaff-secured.html # 安全加固页面
│   ├── auth-service.js       # 安全服务
│   ├── anti-scraping.js      # 防护脚本
│   └── simyo/
│       └── simyo_complete_esim.html
├── netlify/
│   └── functions/             # 安全Functions
├── netlify.toml              # 安全配置
└── build-info.json          # 构建信息
```

## 🔍 部署验证

### 标准版本验证
```bash
# 检查版本信息
curl -I https://your-standard-site.com | grep X-Build-Version
# 应该返回: X-Build-Version: standard

# 检查功能
curl https://your-standard-site.com/build-info.json
```

### 安全版本验证
```bash
# 检查版本信息
curl -I https://your-secure-site.com | grep X-Build-Version
# 应该返回: X-Build-Version: secure

# 检查安全头部
curl -I https://your-secure-site.com | grep Strict-Transport-Security
```

## ⚠️ 注意事项

### 环境变量管理
- 两个版本可能需要不同的环境变量
- 安全版本需要更严格的密钥管理
- 建议为每个版本创建独立的`.env`文件

### 域名和SSL
- 确保两个版本都有有效的SSL证书
- 考虑使用不同的域名以避免混淆

### 监控和日志
- 为不同版本设置独立的监控
- 安全版本需要更详细的安全日志

### 更新策略
- 标准版本可以频繁更新
- 安全版本更新需要更严格的测试流程

## 🚀 快速开始

1. **选择版本**：根据需求选择标准版本或安全版本
2. **配置环境**：复制对应的环境变量配置
3. **构建测试**：本地构建并测试功能
4. **部署上线**：使用对应的部署命令
5. **验证功能**：确认所有功能正常工作

---

**💡 建议**：
- 开发和测试阶段使用标准版本
- 生产环境使用安全版本
- 定期同步两个版本的功能更新