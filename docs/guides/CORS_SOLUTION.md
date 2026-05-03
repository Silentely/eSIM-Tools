# Simyo eSIM CORS 问题解决方案

## 🔍 问题描述

在使用Simyo eSIM申请工具时，遇到了CORS（跨域资源共享）错误：

```
Access to fetch at 'https://appapi.simyo.nl/simyoapi/api/v1/sessions' from origin 'null' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 🎯 问题原因

1. **CORS策略限制**: Simyo的API服务器没有配置允许浏览器直接访问的CORS头
2. **浏览器安全机制**: 现代浏览器阻止跨域请求以保护用户安全
3. **API设计**: Simyo API主要为移动应用设计，未考虑Web浏览器访问

## 💡 解决方案

我们提供了一个Node.js代理服务器来解决CORS问题：

### 方案1: 使用代理服务器（推荐）

#### 快速启动

**Windows用户:**
```bash
# 双击运行
start_simyo_server.bat
```

**macOS/Linux用户:**
```bash
# 添加执行权限并运行
chmod +x start_simyo_server.sh
./start_simyo_server.sh
```

**手动启动:**
```bash
# 安装依赖
npm install

# 启动服务器
npm start
```

#### 技术架构

```
浏览器 → 代理服务器 (localhost:3000) → Simyo API
   ↑                    ↑                      ↑
无CORS限制          添加CORS头              原始API
```

### 方案2: 浏览器插件（临时方案）

安装CORS浏览器插件，如：
- Chrome: "CORS Unblock" 
- Firefox: "CORS Everywhere"

⚠️ **注意**: 此方案有安全风险，仅建议开发测试使用

### 方案3: 浏览器启动参数（开发用）

使用禁用安全检查的参数启动Chrome：
```bash
# Windows
chrome.exe --user-data-dir=/tmp/chrome_dev_test --disable-web-security --disable-features=VizDisplayCompositor

# macOS  
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --user-data-dir=/tmp/chrome_dev_test --disable-web-security

# Linux
google-chrome --user-data-dir=/tmp/chrome_dev_test --disable-web-security
```

⚠️ **警告**: 此方法会禁用浏览器安全功能，仅用于开发测试

## 🛠️ 代理服务器详细说明

### 文件结构
```
eSIM-Tools/
├── server.js                 # 本地开发服务器 (Express + API代理)
├── package.json              # Node.js项目配置
├── netlify/functions/        # 生产环境Serverless函数
└── src/                      # 前端源代码
```

### API端点映射
| 前端请求 | 代理服务器 | Simyo API |
|---------|-----------|-----------|
| `POST /api/simyo/login` | ✅ | `POST /sessions` |
| `GET /api/simyo/esim` | ✅ | `GET /esim/get-by-customer` |
| `POST /api/simyo/confirm-install` | ✅ | `POST /esim/reorder-profile-installed` |

### 代理服务器功能

1. **CORS处理**: 自动添加必要的CORS头
2. **请求转发**: 将前端请求转发到Simyo API
3. **错误处理**: 统一的错误响应格式
4. **日志记录**: 记录所有API请求和响应
5. **静态文件服务**: 直接访问Simyo eSIM工具

### 安全特性

- ✅ 只代理必要的Simyo API端点
- ✅ 不存储用户凭据
- ✅ 请求日志不包含敏感信息
- ✅ 本地运行，数据不经过第三方服务器

## 🚀 使用步骤

### 1. 环境准备
确保已安装Node.js (版本 >= 18.0.0):
```bash
node --version
npm --version
```

### 2. 启动代理服务器
选择适合您系统的启动方式：

**自动启动 (推荐):**
- Windows: 双击 `start_simyo_server.bat`
- macOS/Linux: 运行 `./start_simyo_server.sh`

**手动启动:**
```bash
npm install
npm start
```

### 3. 访问应用
打开浏览器访问: http://localhost:3000

### 4. 使用Simyo工具
现在可以正常使用Simyo eSIM申请功能，CORS问题已解决！

## 🔧 故障排除

### 端口被占用
如果3000端口被占用，修改 `simyo_proxy_server.js`:
```javascript
const PORT = process.env.PORT || 3001; // 改为其他端口
```

### 依赖安装失败
```bash
# 清除npm缓存
npm cache clean --force

# 重新安装
rm -rf node_modules package-lock.json
npm install
```

### Node.js版本过低
```bash
# 检查版本
node --version

# 如果版本 < 18.0.0，请升级Node.js
# 下载地址: https://nodejs.org/
```

## 📋 测试验证

启动服务器后，可以通过以下方式验证：

### 1. 健康检查
```bash
curl http://localhost:3000/api/health
```

期望响应：
```json
{
  "success": true,
  "message": "Simyo eSIM代理服务器运行正常",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### 2. 浏览器访问
直接访问: http://localhost:3000

### 3. API测试
使用Postman或curl测试API端点

## 🛡️ 安全建议

1. **仅本地使用**: 代理服务器仅用于本地开发和个人使用
2. **防火墙设置**: 确保3000端口不对外网开放
3. **定期更新**: 保持Node.js和依赖包的最新版本
4. **凭据保护**: 不要在代码中硬编码敏感信息