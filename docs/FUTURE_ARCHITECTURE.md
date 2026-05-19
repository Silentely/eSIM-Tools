# eSIM-Tools 未来架构规划

> 本文档记录当前尚未实施的架构规划，仅供未来参考。

## 微服务架构迁移

### 当前状态
- 单体 Netlify Functions
- 业务逻辑与 API 处理器紧耦合
- 复用性有限

### 目标架构

```
┌─────────────────────────────────────────────────┐
│           API Gateway / BFF Layer               │
│   (Netlify Edge Functions / Cloudflare Workers) │
└─────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌────▼────────┐
│  Auth Service │ │  Provider  │ │  Activation │
│    (OAuth)    │ │  Adapters  │ │   Service   │
└───────────────┘ └────────────┘ └─────────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │    Shared Middleware        │
        │  (Rate Limit, Auth, Log)    │
        └─────────────────────────────┘
```

**优势:**
- 独立部署和扩展
- 更好的关注点分离
- 更容易测试和维护
- 新运营商的插件架构

**实施计划:**
1. 将共享逻辑提取到 `src/services/core/`
2. 在 `src/services/adapters/` 中创建运营商适配器
3. 在 `src/services/middleware/` 中实现中间件链
4. 添加服务注册表用于动态运营商加载

**代码示例:**
```javascript
// src/services/adapters/BaseProvider.js
/**
 * 运营商适配器基类
 * @abstract
 */
class BaseProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * 认证方法（子类必须实现）
   * @param {Object} credentials - 认证凭据
   * @returns {Promise<Object>} 认证结果
   */
  async authenticate(credentials) {
    throw new Error('Must implement authenticate()');
  }

  /**
   * eSIM 激活方法（子类必须实现）
   * @param {Object} data - 激活数据
   * @returns {Promise<Object>} 激活结果
   */
  async activateESIM(data) {
    throw new Error('Must implement activateESIM()');
  }
}
```

## 可扩展性策略

### 当前限制
- 无状态函数（无会话持久化）
- 有限的并发请求处理
- 无长时间运行任务的作业队列
- 直接 API 调用，无熔断器

### 目标方案

#### A. 添加数据库层

```
┌──────────────────────────────────────┐
│        Application Layer             │
└──────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │                           │
┌───▼──────┐         ┌──────────▼────┐
│ Redis    │         │   PostgreSQL  │
│ (Cache)  │         │   (Sessions)  │
└──────────┘         └───────────────┘
```

**使用场景:**
- 多步骤 OAuth 流程的会话管理
- 跨 Serverless 实例的速率限制
- API 请求去重
- 用户偏好和设置

**技术建议:**
- **Redis**: Upstash Redis (Serverless 友好)
- **PostgreSQL**: Neon 或 Supabase (Serverless Postgres)

#### B. CDN 优先架构

```
用户请求
    │
    ▼
┌─────────────────┐
│   CDN Edge      │  ← 静态资源 (HTML, CSS, JS, Images)
│  (Cloudflare)   │  ← Service Worker precache
└────────┬────────┘
         │ (Cache Miss)
         ▼
┌─────────────────┐
│  Origin Server  │  ← 仅动态 API 请求
│   (Netlify)     │
└─────────────────┘
```

**优化:**
- 对哈希资源设置长缓存时间 (1 年)
- HTML 使用 stale-while-revalidate
- 实现边缘渲染个性化内容
- 预获取关键 API 响应

#### C. 后台处理作业队列

```
API Request → Enqueue Job → Return Job ID
                  │
                  ▼
          ┌──────────────┐
          │  Job Queue   │
          │  (BullMQ)    │
          └──────┬───────┘
                 │
         ┌───────┴────────┐
         │                │
    ┌────▼────┐     ┌─────▼────┐
    │ Worker 1│     │ Worker 2 │
    └─────────┘     └──────────┘
```

**使用场景:**
- 图片优化
- 批量 eSIM 激活
- 报告生成
- 邮件通知

**技术:** BullMQ + Redis 后端

## 未来功能规划

### A. 多运营商插件系统

**接口定义:**
```javascript
/**
 * 运营商插件接口
 * @interface ProviderPlugin
 */
// 所有方法由具体运营商适配器实现:
// - authenticate(credentials) → Promise<Token>
// - activateESIM(data) → Promise<Result>
// - getStatus(id) → Promise<Status>
// - validate(data) → ValidationResult
```

**插件注册表:**
```javascript
class PluginRegistry {
  constructor() {
    this.plugins = new Map();
  }

  async loadPlugin(name) {
    const plugin = await import(`./plugins/${name}`);
    this.plugins.set(name, plugin);
  }

  getProvider(name) {
    return this.plugins.get(name);
  }
}
```

**优势:**
- 轻松添加新运营商
- 社区贡献
- A/B 测试不同实现
- 运营商 API 渐进迁移

### B. 实时状态追踪

**WebSocket 架构:**
```
Client → WebSocket → Server → Provider API
  │                              │
  └──────── Status Updates ──────┘
```

**Server-Sent Events 实现 (更简单):**
```javascript
// 客户端
const eventSource = new EventSource('/api/esim-status?id=123');
eventSource.onmessage = (event) => {
  const status = JSON.parse(event.data);
  updateUI(status);
};
```

### C. 离线优先 PWA 与后台同步

**增强的 Service Worker 策略:**
```javascript
// 后台同步失败的请求
self.addEventListener('sync', (event) => {
  if (event.tag === 'esim-activation') {
    event.waitUntil(retryActivation());
  }
});
```

**功能:**
- 离线时队列 eSIM 激活请求
- 连接恢复后自动重试
- 使用 IndexedDB 进行本地状态管理
- 并发编辑的冲突解决

### D. 分析仪表板

**追踪指标:**
- 按运营商统计激活成功率
- 平均激活时间
- 错误率和类型
- 用户旅程分析
- 性能指标 (Core Web Vitals)
