# eSIM-Tools 项目指导文件

> **专为 Giffgaff 和 Simyo 用户设计的 eSIM 管理工具集**
> 版本: 2.0.0 | Node: >=18.0.0 | 部署平台: Netlify

---

## 📐 项目架构

### 架构模式
- **前端**: 原生 JavaScript (ES2021+) + 模块化组件
- **后端**: Serverless (Netlify Functions + Edge Functions)
- **构建工具**: Webpack 5 + Babel + PostCSS
- **部署架构**: JAMstack (静态托管 + Serverless API)

### 关键架构决策
1. **无框架设计**: 使用原生 JavaScript 避免框架依赖和打包体积
2. **Serverless 优先**: 所有后端逻辑通过 Netlify Functions 实现
3. **BFF 模式**: Edge Functions 作为 Backend-For-Frontend 代理层
4. **中间件统一**: 通过 `withAuth` 中间件统一处理鉴权、CORS、验证

### 部署流程
```
本地开发 → 构建静态资源 → 部署到 Netlify
├─ npm run dev          (本地开发服务器 + 热重载)
├─ npm run build        (Webpack 打包优化)
└─ npm run deploy       (部署到 Netlify 生产环境)
```

---

## 🛠️ 项目技术栈

### 核心依赖
| 技术 | 版本 | 用途 |
|------|------|------|
| **axios** | ^1.12.0 | HTTP 请求库 (Functions) |
| **cheerio** | ^1.0.0-rc.12 | HTML 解析 (爬虫场景) |
| **express** | ^4.18.2 | 本地开发服务器 |
| **helmet** | ^7.1.0 | 安全头部中间件 |

### 构建工具链
| 工具 | 版本 | 用途 |
|------|------|------|
| **webpack** | ^5.89.0 | 模块打包 |
| **babel** | ^7.23.0 | ES6+ 转译 |
| **postcss** | ^8.4.31 | CSS 后处理 |
| **terser** | ^5.3.9 | JS 压缩混淆 |
| **sharp** | ^0.34.3 | 图片优化 |
| **esbuild** | ^0.25.8 | 快速构建 |

### 测试框架
| 工具 | 版本 | 用途 |
|------|------|------|
| **jest** | ^29.7.0 | 单元测试框架 |
| **@testing-library/jest-dom** | ^6.1.5 | DOM 测试工具 |

---

## 📂 项目模块划分

### 文件与文件夹布局

```
eSIM-Tools/
├── src/                          # 源代码目录
│   ├── js/                       # 通用 JavaScript 模块
│   │   ├── modules/              # 可复用模块
│   │   │   ├── logger.js         # 日志模块 (生产环境自动禁用)
│   │   │   ├── api-service.js    # API 封装
│   │   │   ├── secure-storage.js # 安全存储
│   │   │   ├── html-sanitizer.js # XSS 防护
│   │   │   ├── performance-monitor.js # 性能监控
│   │   │   └── i18n.js           # 国际化
│   │   └── main.js               # 应用入口
│   ├── giffgaff/                 # Giffgaff 专属模块
│   │   ├── js/modules/           # Giffgaff 业务模块
│   │   │   ├── oauth-handler.js  # OAuth 2.0 PKCE 流程
│   │   │   └── mfa-handler.js    # 多因素认证处理
│   │   └── giffgaff_modular.html # Giffgaff 页面
│   ├── simyo/                    # Simyo 专属模块
│   │   └── simyo_modular.html    # Simyo 页面
│   ├── styles/                   # CSS 样式
│   ├── images/                   # 图片资源
│   └── assets/                   # 其他静态资源
│
├── netlify/                      # Netlify 部署配置
│   ├── functions/                # Serverless Functions
│   │   ├── _shared/              # 共享模块
│   │   │   └── middleware.js     # 统一中间件 (鉴权/CORS/验证)
│   │   ├── giffgaff-graphql.js   # Giffgaff GraphQL 代理
│   │   ├── giffgaff-mfa-challenge.js  # MFA 挑战
│   │   ├── giffgaff-mfa-validation.js # MFA 验证
│   │   ├── giffgaff-sms-activate.js   # SMS 激活
│   │   ├── giffgaff-token-exchange.js # Token 交换
│   │   ├── auto-activate-esim.js      # 自动激活
│   │   ├── verify-cookie.js           # Cookie 验证
│   │   └── health.js                  # 健康检查
│   └── edge-functions/           # Edge Functions (Deno)
│       └── bff-proxy.js          # BFF 代理层
│
├── scripts/                      # 构建与自动化脚本
│   ├── logger.js                 # 构建日志模块 (彩色输出)
│   ├── build-static.js           # 静态资源构建
│   ├── deploy-prepare.js         # 部署准备
│   ├── quality-check.js          # 代码质量检查
│   ├── security-check.js         # 安全检查
│   ├── optimize-images.js        # 图片优化
│   └── compress.js               # 资源压缩
│
├── tests/                        # 测试文件
│   ├── __mocks__/                # Mock 文件
│   └── giffgaff/                 # Giffgaff 模块测试
│
├── docs/                         # 项目文档
│   ├── guides/                   # 使用指南
│   ├── reference/                # API 参考
│   └── fixes/                    # 修复记录
│
├── dist/                         # 构建输出目录 (自动生成)
├── server.js                     # 本地开发服务器
├── webpack.config.js             # Webpack 配置
├── netlify.toml                  # Netlify 部署配置
├── package.json                  # 项目依赖
├── .eslintrc.json                # ESLint 配置
├── env.example                   # 环境变量模板
└── CLAUDE.md                     # 本文件
```

---

## 🎯 项目业务模块

### 1. Giffgaff eSIM 管理
**核心功能**:
- OAuth 2.0 PKCE 登录流程
- MFA (多因素认证) 双通道支持 (EMAIL/SMS)
- eSIM 预订与激活
- GraphQL API 代理

**关键文件**:
- `src/giffgaff/js/modules/oauth-handler.js` - OAuth 流程
- `netlify/functions/giffgaff-mfa-challenge.js` - MFA 挑战
- `netlify/functions/giffgaff-graphql.js` - GraphQL 代理

### 2. Simyo eSIM 管理
**核心功能**:
- Simyo API 代理
- eSIM 激活流程

**关键文件**:
- `src/simyo/simyo_modular.html`
- Netlify Redirects: `/api/simyo/*` → `https://appapi.simyo.nl`

### 3. 通用工具模块
**核心模块**:
- **Logger**: 环境感知日志 (生产环境自动禁用)
- **Secure Storage**: 加密本地存储
- **HTML Sanitizer**: XSS 防护
- **Performance Monitor**: 性能监控
- **API Service**: 统一 HTTP 客户端

---

## 📝 项目代码风格与规范

### 命名约定

#### 类命名
- **类名**: PascalCase
  ```javascript
  class AuthError extends Error { }
  class PerformanceMonitor { }
  ```

#### 变量命名
- **常量**: UPPER_SNAKE_CASE (全局常量)
  ```javascript
  const ALLOWED_ORIGIN = 'https://esim.cosr.eu.org';
  const ACCESS_KEY = process.env.ACCESS_KEY;
  ```

- **变量/函数**: camelCase
  ```javascript
  const userName = 'John';
  function validateInput(schema, data) { }
  ```

- **私有变量**: 下划线前缀 (可选)
  ```javascript
  function handler(event, _context) { }  // _context 表示未使用
  ```

#### 文件命名
- **模块文件**: kebab-case
  ```
  oauth-handler.js
  api-service.js
  html-sanitizer.js
  ```

- **组件/类文件**: kebab-case
  ```
  performance-monitor.js
  secure-storage.js
  ```

---

### 代码风格 (ESLint 规则)

#### Import 规则
```javascript
// ✅ 推荐: 使用相对路径导入本地模块
import Logger from '../modules/logger.js';
import { validateInput } from './_shared/middleware.js';

// ✅ Node 环境: 使用 require
const axios = require('axios');

// ❌ 避免: 循环依赖
```

**Import 顺序**:
1. Node 内置模块
2. 第三方依赖
3. 本地模块

```javascript
// Node 内置
const fs = require('fs');

// 第三方依赖
const axios = require('axios');

// 本地模块
const Logger = require('./modules/logger.js');
```

---

#### 依赖注入

**Functions 中间件模式**:
```javascript
// ✅ 推荐: 使用中间件注入依赖
const { withAuth, validateInput } = require('./_shared/middleware');

const schema = {
  field: { required: true, type: 'string', minLength: 10 }
};

exports.handler = withAuth(async (event, context, { auth, body }) => {
  // auth: 鉴权结果
  // body: 已验证的请求体

  // 业务逻辑
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}, { validateSchema: schema });
```

**前端模块**:
```javascript
// ✅ 推荐: 使用静态方法避免实例化
Logger.log('信息日志');
Logger.warn('警告日志');
Logger.error('错误日志');
Logger.sensitive('Token', token, 5);  // 自动脱敏
```

---

#### 日志规范

**前端日志** (`src/js/modules/logger.js`):
```javascript
import Logger from './modules/logger.js';

// 生产环境自动禁用 (NODE_ENV=production)
Logger.log('调试信息');           // 仅开发环境输出
Logger.warn('警告信息');          // 始终输出
Logger.error('错误信息');         // 始终输出
Logger.sensitive('密钥', key, 5); // 自动遮蔽敏感数据
```

**构建脚本日志** (`scripts/logger.js`):
```javascript
const BuildLogger = require('./logger.js');

BuildLogger.log('普通信息');      // 蓝色 [INFO]
BuildLogger.success('成功信息');  // 绿色 [SUCCESS]
BuildLogger.warn('警告信息');     // 黄色 [WARN]
BuildLogger.error('错误信息');    // 红色 [ERROR]
BuildLogger.title('标题');        // 粗体蓝色
BuildLogger.step(1, 4, '步骤1');  // [1/4] 步骤1
```

**Functions 日志** (使用 console):
```javascript
// ✅ 结构化日志
console.error('[FunctionName] Error:', JSON.stringify({
  context: 'giffgaff-mfa',
  message: error.message,
  status: 500,
  timestamp: new Date().toISOString()
}));

// ❌ 避免: 在生产环境使用 console.log
```

---

#### 异常处理

**统一错误类**:
```javascript
// netlify/functions/_shared/middleware.js
class AuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

// 使用
throw new AuthError('Unauthorized: Missing auth key', 401);
throw new AuthError('Origin not allowed', 403);
throw new AuthError('Validation failed', 400);
```

**中间件统一捕获**:
```javascript
// ✅ 推荐: 由 withAuth 自动处理
exports.handler = withAuth(async (event, context, { auth, body }) => {
  // 任何抛出的错误都会被中间件捕获并格式化
  if (!body.required) {
    throw new AuthError('Missing required field', 400);
  }

  // 业务逻辑
}, { validateSchema: schema });

// ❌ 避免: 手动 try-catch (中间件已处理)
```

**前端错误处理**:
```javascript
try {
  const response = await apiService.post('/api/endpoint', data);
  return response.data;
} catch (error) {
  Logger.error('API调用失败:', error.message);

  // 用户友好的错误提示
  if (error.response?.status === 401) {
    showError('认证失败，请重新登录');
  } else {
    showError('操作失败，请稍后重试');
  }

  throw error;  // 向上传播
}
```

---

#### 参数校验

**Functions 输入验证** (使用 Schema):
```javascript
const { validateInput } = require('./_shared/middleware');

// 定义 Schema
const mfaValidationSchema = {
  ref: {
    required: true,
    type: 'string',
    minLength: 10
  },
  code: {
    required: true,
    type: 'string',
    minLength: 4,
    maxLength: 10,
    pattern: /^\d+$/  // 仅数字
  },
  source: {
    required: false,
    type: 'string',
    enum: ['esim', 'web', 'app']
  }
};

// 自动验证
exports.handler = withAuth(async (event, context, { auth, body }) => {
  // body 已通过 schema 验证
  const { ref, code } = body;

  // 业务逻辑
}, { validateSchema: mfaValidationSchema });
```

**Schema 规则**:
- `required`: 布尔值，是否必填
- `type`: 字符串，数据类型 (`'string'`, `'number'`, `'boolean'`, `'object'`, `'array'`)
- `minLength` / `maxLength`: 数字，字符串长度限制
- `pattern`: 正则表达式，格式验证
- `enum`: 数组，枚举值限制

**前端验证**:
```javascript
// ✅ 推荐: 使用工具函数
import { sanitizeHTML } from './modules/html-sanitizer.js';

const userInput = document.querySelector('#input').value;
const safeHTML = sanitizeHTML(userInput);  // XSS 防护

// 表单验证
function validateEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}
```

---

#### 其他规范

**1. 严格模式**
```javascript
// 所有文件顶部
'use strict';
```

**2. 使用 const/let 替代 var**
```javascript
// ✅ 推荐
const API_URL = 'https://api.example.com';
let counter = 0;

// ❌ 避免
var API_URL = 'https://api.example.com';
```

**3. 严格相等**
```javascript
// ✅ 推荐
if (value === null) { }
if (value !== undefined) { }

// ❌ 避免
if (value == null) { }
```

**4. 括号规范**
```javascript
// ✅ 推荐: 始终使用大括号
if (condition) {
  doSomething();
}

// ❌ 避免: 单行省略大括号
if (condition) doSomething();
```

**5. 缩进与格式**
- **缩进**: 2 空格
- **引号**: 单引号 `'string'` (允许双引号避免转义)
- **分号**: 必须使用
- **行尾逗号**: 多行对象/数组允许
- **括号风格**: 1TBS (One True Brace Style)

```javascript
// ✅ 正确格式
const config = {
  key1: 'value1',
  key2: 'value2',  // 允许尾逗号
};

function example() {
  if (condition) {
    return true;
  } else {
    return false;
  }
}
```

**6. 安全编码**
```javascript
// ✅ 禁止使用 eval
// ❌ eval('code');

// ✅ 禁止使用 Function 构造器
// ❌ new Function('return 1');

// ✅ 禁止 innerHTML (使用 textContent 或 sanitizeHTML)
element.textContent = userInput;  // 安全
element.innerHTML = sanitizeHTML(userInput);  // XSS 防护

// ❌ element.innerHTML = userInput;  // 危险
```

---

## 🧪 测试与质量

### 单元测试

**测试框架**: Jest 29.7.0
**测试环境**: jsdom (模拟浏览器环境)

**运行测试**:
```bash
npm test              # 运行所有测试
npm run test:watch    # 监听模式
npm run test:coverage # 生成覆盖率报告
```

**测试文件位置**:
```
tests/
├── __mocks__/         # Mock 数据
├── giffgaff/          # Giffgaff 模块测试
│   ├── oauth.test.js
│   └── mfa.test.js
└── utils.test.js      # 工具函数测试
```

**测试示例**:
```javascript
// tests/giffgaff/oauth.test.js
import { generateCodeChallenge } from '../../src/giffgaff/js/modules/oauth-handler.js';

describe('OAuth Handler', () => {
  test('generateCodeChallenge 应返回 Base64URL 编码的 SHA256 哈希', () => {
    const verifier = 'test_code_verifier';
    const challenge = generateCodeChallenge(verifier);

    expect(challenge).toBeTruthy();
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);  // Base64URL 格式
  });
});
```

---

### 集成测试

**Functions 集成测试**:
```bash
# 本地模拟 Netlify 环境
npm run netlify-dev

# 访问 Functions
curl -X POST http://localhost:8888/.netlify/functions/health \
  -H "X-Esim-Key: your_access_key"
```

**部署前验证**:
```bash
npm run quality-check   # 代码质量检查
npm run security-check  # 安全检查
npm run deploy-test     # 部署配置验证
```

---

### 代码质量工具

**质量检查脚本** (`scripts/quality-check.js`):
```bash
npm run quality-check
```

**检查项**:
1. **语法检查**: 验证所有 JS 文件语法正确
2. **环境变量一致性**: 验证 `env.example` 配置
3. **依赖完整性**: 检查未使用的依赖
4. **安全配置**: 扫描弱默认值、硬编码密钥

**通过标准**: 100% (14/14 检查项)

---

## ⚙️ 项目构建、测试与运行

### 环境与配置

**环境变量** (参考 `env.example`):
```bash
# CORS 配置
ALLOWED_ORIGIN=https://esim.cosr.eu.org

# 受保护函数访问密钥
# ⚠️ 必填: Server 与 Functions/BFF 共享的访问密钥
# 🔐 生成强随机密钥: openssl rand -hex 32
ACCESS_KEY=your_strong_random_key_here

# Cloudflare Turnstile 站点密钥 (可选)
TURNSTILE_SITE_KEY=0x4AAAAAAA...

# Node 环境
NODE_ENV=development  # development | production
```

**本地环境配置**:
```bash
# 1. 复制环境变量模板
cp env.example .env

# 2. 编辑 .env 文件并填写密钥
# ACCESS_KEY=<运行 openssl rand -hex 32 生成>

# 3. 安装依赖
npm install

# 4. 启动开发服务器
npm run dev
```

---

### 开发流程

**本地开发**:
```bash
# 方式 1: 简单开发服务器 (server.js)
npm run dev
# 访问: http://localhost:3000

# 方式 2: Netlify Dev (完整模拟 Netlify 环境)
npm run netlify-dev
# 访问: http://localhost:8888
```

**构建流程**:
```bash
# 1. 构建静态资源
npm run build

# 输出:
# dist/
# ├── js/bundle.*.js        # Webpack 打包后的 JS
# ├── css/styles.*.css      # PostCSS 处理后的 CSS
# ├── images/               # 优化后的图片
# └── index.html            # HTML 文件
```

**部署流程**:
```bash
# 1. 预部署检查
npm run quality-check
npm run security-check
npm run deploy-test

# 2. 部署到生产环境
npm run deploy

# 或者通过 Git 推送自动部署 (GitHub Actions)
git push origin main
```

---

### 环境差异处理

**开发环境** (`NODE_ENV=development`):
- Logger 启用调试日志
- 详细错误堆栈
- 未压缩的代码
- Source Maps

**生产环境** (`NODE_ENV=production`):
- Logger 自动禁用 `.log()`
- 简化错误信息
- 代码压缩混淆
- 无 Source Maps

**代码示例**:
```javascript
// Logger 自动识别环境
if (process.env.NODE_ENV === 'production') {
  Logger.log = () => {};  // 生产环境禁用
}
```

---

## 🔄 Git 工作流程

### 分支策略

**主分支**:
- `main`: 生产环境分支 (受保护)

**开发分支** (推荐):
```
feature/<feature-name>   # 新功能
fix/<bug-name>           # Bug 修复
refactor/<module-name>   # 重构
docs/<doc-name>          # 文档更新
```

**示例**:
```bash
# 创建功能分支
git checkout -b feature/oauth-enhancement

# 开发完成后合并到 main
git checkout main
git merge feature/oauth-enhancement
git push origin main
```

---

### 提交规范 (Conventional Commits)

**格式**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**:
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 重构 (不改变功能)
- `perf`: 性能优化
- `style`: 代码格式 (不影响逻辑)
- `docs`: 文档更新
- `test`: 测试相关
- `chore`: 构建/工具配置

**示例**:
```bash
# 新功能
git commit -m "feat(giffgaff): 添加 MFA 双通道支持

- 支持 EMAIL 和 SMS 验证码
- 自动 Cookie 刷新机制

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Bug 修复
git commit -m "fix(middleware): 修复 CORS 预检请求处理

确保 OPTIONS 请求正确返回 200 状态码"

# 重构
git commit -m "refactor(functions): 统一中间件架构

- 消除 400 行重复代码
- 标准化输入验证
- 代码减少 25%"
```

---

### Pull Request 规范

**PR 标题**:
```
feat: 添加用户认证功能
fix: 修复 eSIM 激活失败问题
refactor: 重构 Functions 中间件架构
```

**PR 描述模板**:
```markdown
## Summary
<!-- 简述本次变更的目的 -->
实现 Giffgaff OAuth 2.0 PKCE 登录流程

## Changes
<!-- 具体变更内容 -->
- ✅ 添加 PKCE Code Verifier/Challenge 生成
- ✅ 实现 OAuth 授权码流程
- ✅ 添加 Token 交换 Function

## Test Plan
<!-- 测试计划 -->
- [ ] 本地测试 OAuth 流程
- [ ] 验证 Token 交换正确性
- [ ] 测试错误处理逻辑

## Screenshots
<!-- 截图 (如有 UI 变更) -->

🤖 Generated with Claude Code
```

---

### Git Hooks (推荐)

**Pre-commit 检查**:
```bash
# .git/hooks/pre-commit
#!/bin/bash
npm run quality-check
if [ $? -ne 0 ]; then
  echo "❌ 质量检查失败，提交已阻止"
  exit 1
fi
```

---

## 📚 文档目录

### 文档存储规范

**核心文档位置**:
```
docs/
├── guides/                    # 使用指南
│   ├── giffgaff-setup.md      # Giffgaff 配置指南
│   ├── simyo-setup.md         # Simyo 配置指南
│   └── deployment.md          # 部署指南
│
├── reference/                 # API 参考
│   ├── functions-api.md       # Functions API 文档
│   ├── middleware-api.md      # 中间件 API
│   └── frontend-modules.md    # 前端模块文档
│
├── fixes/                     # 修复记录
│   ├── HIGH_PRIORITY_FIXES.md # 高优先级修复清单
│   └── security-fixes.md      # 安全修复记录
│
├── video/                     # 视频教程资源
└── image/                     # 文档图片资源
```

**重要文档清单**:

| 文档 | 位置 | 说明 |
|------|------|------|
| **项目配置** | `CLAUDE.md` | 本文件，项目架构和规范 |
| **环境变量** | `env.example` | 环境变量模板 |
| **变更总结** | `REFACTOR_SUMMARY.md` | 重构变更详细报告 |
| **迁移指南** | `MIGRATION_ACCESS_KEY.md` | 环境变量迁移文档 |
| **API 参考** | `docs/reference/` | Functions 和模块 API |
| **部署配置** | `netlify.toml` | Netlify 部署配置 |

---

### 文档编写规范

**Markdown 格式**:
```markdown
# 一级标题 (文档主标题)

## 二级标题 (章节)

### 三级标题 (子章节)

**粗体**: 强调关键信息
*斜体*: 术语或引用

- 无序列表
1. 有序列表

\`行内代码\`

\`\`\`javascript
// 代码块 (指定语言)
const example = 'code';
\`\`\`

> 引用块
> 用于重要提示

| 表头1 | 表头2 |
|------|------|
| 内容1 | 内容2 |

[链接文本](URL)
```

**文档更新原则**:
1. 代码变更必须同步更新文档
2. API 变更必须更新 API 参考文档
3. 新功能必须添加使用指南
4. 重要修复记录到 `docs/fixes/`

---

## 🔐 安全规范

### 敏感数据处理

**环境变量**:
```javascript
// ✅ 从环境变量读取
const ACCESS_KEY = process.env.ACCESS_KEY;

// ❌ 禁止硬编码
const ACCESS_KEY = 'hardcoded_key';  // 危险!
```

**日志脱敏**:
```javascript
// ✅ 自动脱敏
Logger.sensitive('Token', token, 5);  // 仅显示前 5 位

// ❌ 避免明文日志
console.log('Token:', token);  // 泄露敏感信息
```

**前端存储**:
```javascript
// ✅ 使用加密存储
import SecureStorage from './modules/secure-storage.js';
SecureStorage.set('key', 'value');

// ❌ 避免明文存储
localStorage.setItem('key', sensitiveData);
```

---

### XSS 防护

**HTML 插入**:
```javascript
import { sanitizeHTML } from './modules/html-sanitizer.js';

// ✅ 安全插入
element.innerHTML = sanitizeHTML(userInput);

// ✅ 纯文本
element.textContent = userInput;

// ❌ 危险操作
element.innerHTML = userInput;  // XSS 风险
```

---

### CORS 配置

**严格来源验证**:
```javascript
// netlify/functions/_shared/middleware.js
const ALLOWED_ORIGIN = 'https://esim.cosr.eu.org';

// 拒绝非法来源
if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
  throw new AuthError('Origin not allowed', 403);
}
```

**Netlify CORS 配置**:
```toml
# netlify.toml
[[headers]]
  for = "/api/simyo/*"
  [headers.values]
    Access-Control-Allow-Origin = "https://esim.cosr.eu.org"
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"
    Vary = "Origin"
```

---

## 🚀 性能优化

### 构建优化

**Webpack 配置** (已启用):
- Terser 压缩 (JS 混淆)
- Tree Shaking (移除未使用代码)
- Code Splitting (按需加载)
- Gzip 压缩 (CompressionWebpackPlugin)

**图片优化**:
```bash
npm run optimize-images  # 使用 sharp 压缩图片
```

---

### 运行时优化

**懒加载**:
```javascript
// 动态导入模块
const module = await import('./modules/heavy-module.js');
```

**性能监控**:
```javascript
import PerformanceMonitor from './modules/performance-monitor.js';

PerformanceMonitor.mark('start');
// ... 操作 ...
PerformanceMonitor.measure('operation', 'start');
```

---

## 🛠️ 故障排查

### 常见问题

**1. Functions 认证失败**
```
错误: Unauthorized: Missing or invalid auth key
解决: 检查 Netlify 环境变量中是否配置 ACCESS_KEY
```

**2. CORS 错误**
```
错误: Origin not allowed
解决: 验证请求来源是否为 https://esim.cosr.eu.org
```

**3. 日志缺失**
```
问题: 生产环境看不到日志
原因: Logger.log() 在生产环境自动禁用
解决: 使用 Logger.warn() 或 Logger.error() 输出关键信息
```

**4. 构建失败**
```bash
# 清理缓存重新构建
rm -rf node_modules dist
npm install
npm run build
```

---

## 📞 联系与支持

**项目仓库**: https://github.com/Silentely/eSIM-Tools
**问题反馈**: https://github.com/Silentely/eSIM-Tools/issues
**生产环境**: https://esim.cosr.eu.org

---

**最后更新**: 2025-11-23
**维护团队**: eSIM Tools Team
**许可证**: MIT
