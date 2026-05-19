# eSIM-Tools 架构说明

## 当前架构

### 概述

eSIM-Tools 是一个 Web 应用，用于管理 Giffgaff 和 Simyo 运营商的 eSIM 激活。采用无服务器架构，Netlify Functions 作为后端 API，静态托管作为前端。

### 技术栈

- **前端**: 原生 JavaScript, Bootstrap, PWA
- **后端**: Node.js/Express (本地开发), Netlify Functions (生产环境)
- **构建工具**: Webpack, Babel, PostCSS
- **优化工具**: Sharp (图片), Terser (JS), Workbox (Service Worker)

### 部署架构

```
用户请求 → Netlify CDN (静态资源) → Netlify Functions (API) → 运营商 API
                ↓
        Edge Functions (BFF 代理层，注入 ACCESS_KEY)
```

## 构建优化将打包体积减少 25% 并提升缓存效率

### 1. 图片处理速度提升 2.4 倍 (`scripts/optimize-images.js`)

**问题**: 旧脚本串行处理图片，10 张图片需要 60 秒。

**方案**: 改为并行处理（可配置并发数），加入智能缓存跳过已优化文件，支持 mozjpeg 和 adaptive filtering 压缩。

**效果**: 处理时间从 60 秒降至 25 秒，压缩率提升 30-40%。

### 2. 压缩率提升 15-20% (`scripts/compress.js`)

**问题**: 旧压缩脚本仅使用 Gzip，且每次都全量压缩。

**方案**: 同时生成 Brotli + Gzip 双版本，加入基于缓存的跳过逻辑避免重复压缩。

**效果**: 压缩率提升 15-20%，后续构建只需压缩变更文件。

### 3. 滚动性能提升，内存泄漏消除 (`src/js/performance.js`)

**问题**: Intersection Observer 未清理导致内存泄漏，图片在进入视口后才开始加载。

**方案**: 统一 Observer 生命周期管理，视口前预加载图片，加入错误处理。

**效果**: 内存使用减少 10-15%，滚动更流畅。

### 4. 打包体积减少 25%，长期缓存更优 (`webpack.config.js`)

**问题**: 打包体积 ~450KB (gzip)，第三方库未分离，缓存命中率低。

**方案**: 拆分第三方 chunk，提取 runtime，使用确定性模块 ID，加入 Brotli 插件和 500KB 性能预算。

**效果**: 打包体积降至 ~340KB (gzip) / ~280KB (brotli)。

### 5. 通用工具函数库 (`src/js/modules/utils.js`)

提供 debounce (leading/trailing)、throttle (RAF)、记忆化、指数退避重试、bytes/JSON 格式化等常用工具。

### 6. 请求验证与安全防护 (`src/js/middleware/validation.js`)

提供请求体大小验证、Header 校验、XSS 清理、内存级速率限制、请求计时日志和异步错误边界。

## 性能基准

以下数据基于 Lighthouse 测量（Chrome DevTools，模拟 4G 网络）：

### 优化前
- 打包体积: ~450KB (gzip)
- 图片优化: 10 张图片 60 秒
- First Contentful Paint: 1.8s
- Time to Interactive: 3.2s

### 优化后
- 打包体积: ~340KB (gzip), ~280KB (brotli)
- 图片优化: 10 张图片 25 秒 (2.4x 提升)
- First Contentful Paint: 1.2s (提升 33%)
- Time to Interactive: 2.1s (提升 34%)

## 实施路线

### 阶段 1: 代码质量 (已完成)
- 优化构建工具
- 添加工具库
- 改进错误处理
- 添加验证中间件

### 阶段 2: 基础设施 (规划中)
- 添加 Redis 缓存
- 实现速率限制
- 设置监控 (Sentry, LogRocket)
- 添加端到端测试

> 更多未来架构规划请参考 [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md)
