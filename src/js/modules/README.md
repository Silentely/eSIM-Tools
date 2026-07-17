# JavaScript Modules Documentation

This directory contains reusable JavaScript modules that provide common functionality across the application.

## Module Overview

### Core Utilities

#### `utils.js`
General utility functions for common operations.

**Features:**
- `debounce(func, wait, immediate)` - Debounce function execution
- `throttle(func, limit)` - Throttle function calls
- `rafThrottle(func)` - RequestAnimationFrame-based throttling
- `memoize(func, resolver)` - Memoize function results
- `retry(fn, maxRetries, delay)` - Retry async operations with exponential backoff
- `formatBytes(bytes, decimals)` - Format bytes to human-readable string
- `deepClone(obj)` - Deep clone objects
- `safeJsonParse(json, fallback)` - Safe JSON parsing with fallback

**Usage:**
```javascript
import { debounce, retry, formatBytes } from '@utils';

const debouncedSearch = debounce((query) => {
  performSearch(query);
}, 300);

const data = await retry(() => fetch('/api/data'), 3, 1000);
console.log(formatBytes(1024 * 1024)); // "1 MB"
```

### API & Network

#### `api-service.js`
> **状态：未挂载生产业务路径**（仅单测覆盖）。Giffgaff/Simyo 业务目前使用原生 `fetch`。  
> 保留本模块作为统一 HTTP 客户端候选实现，**接入前需评审重试/缓存对 OAuth/MFA 的影响**。

Centralized API service with built-in retry, caching, and request deduplication.

**Features:**
- Automatic retry on failure
- Request/response caching
- Request deduplication for concurrent identical requests
- Timeout handling
- GET, POST, PUT, DELETE methods

**Usage（测试或后续接入时）:**
```javascript
import { giffgaffAPI, simyoAPI } from './api-service.js';

const data = await giffgaffAPI.get('/giffgaff-graphql');
await simyoAPI.post('/activate', { phone: '123456789' });
giffgaffAPI.clearCache();
```

#### `clipboard.js`
Shared clipboard helper. Re-exported by Giffgaff/Simyo `utils.js` so existing import paths stay stable.

#### `diagnostics.js`
Issue 诊断导出。业务页初始化后可在控制台执行：

```js
copyEsimDiagnostics() // 复制脱敏 JSON 到剪贴板，便于粘贴到 GitHub Issue
```

不包含 token / 密码 / cookie / LPA 等敏感字段。

#### `resource-hints.js`
> **状态：未挂载生产页面**。路径已对齐原生 ES 模块静态托管，但 HTML 入口尚未 `import` 本模块。  
> 生产页面当前依赖浏览器默认加载与各页已写死的 script/link。

Manages preconnect, preload, prefetch for optimal resource loading.

### Performance

#### `performance-monitor.js`
> **状态：未挂载生产页面**。首页/业务页实际加载的是 `src/js/performance.js`（非本 CWV 模块）。  
> 勿与生产监控能力混淆；接入前需确认上报目标与采样策略。

Tracks Core Web Vitals and custom performance metrics (LCP/FID/CLS/FCP/TTFB).

#### `sentry-init.js` / 页面加载说明
> **生产主路径：** HTML `<head>` 中的 `sentry-config.js` + `sentry-loader.js`（CDN）。  
> `sentry-init.js` 仅由遗留 `src/js/main.js`（Webpack 入口）引用，**当前 `npm run build` 不会打包该入口**。

### Configuration

#### `app-config.js`
Centralized configuration management with environment-specific settings.

**Features:**
- Environment detection (development, production, test)
- Deep merge of environment configs
- Feature flags
- Runtime configuration updates
- Provider-specific settings

**Usage:**
```javascript
import appConfig from '@modules/app-config';

// Get configuration value
const timeout = appConfig.get('api.timeout');

// Check feature flag
if (appConfig.isFeatureEnabled('analytics')) {
  initAnalytics();
}

// Environment checks
if (appConfig.isDevelopment()) {
  console.log('Running in development mode');
}
```

## Server-side Modules

### `middleware/validation.js`
Express middleware for request validation and security.

**Features:**
- Body size validation
- Required headers validation
- XSS parameter sanitization
- Rate limiting
- Request logging with timing
- Async error handling wrapper

**Usage:**
```javascript
const {
  validateBodySize,
  sanitizeParams,
  createRateLimiter,
  asyncHandler
} = require('./middleware/validation');

// Apply middleware
app.use(validateBodySize(1024 * 1024)); // 1MB limit
app.use(sanitizeParams);
app.use(createRateLimiter({ maxRequests: 100, windowMs: 60000 }));

// Wrap async routes
app.get('/api/data', asyncHandler(async (req, res) => {
  const data = await fetchData();
  res.json(data);
}));
```

## Module Path Aliases

Webpack is configured with the following aliases for cleaner imports:

```javascript
// Instead of relative paths
import utils from '../../../modules/utils';

// Use aliases
import utils from '@utils';
import APIService from '@modules/api-service';
import config from '@modules/app-config';
```

## Best Practices

### 1. Import Only What You Need
```javascript
// Good
import { debounce, throttle } from '@utils';

// Avoid
import * as utils from '@utils';
```

### 2. Use Async/Await with Error Handling
```javascript
import { retry } from '@utils';

try {
  const data = await retry(() => fetch('/api/data'), 3);
} catch (error) {
  console.error('Failed after retries:', error);
}
```

### 3. Cache API Responses Appropriately
```javascript
import api from '@modules/api-service';

// Cache for 5 minutes
const data = await api.get('/data', { cacheTime: 300000 });
```

### 4. Monitor Performance in Production
```javascript
import monitor from '@modules/performance-monitor';

if (config.isProduction()) {
  // Metrics are automatically collected
  // Set up your analytics integration in the monitor
}
```

### 5. Use Feature Flags for Gradual Rollouts
```javascript
import config from '@modules/app-config';

if (config.isFeatureEnabled('newFeature')) {
  initNewFeature();
}
```

## Testing

All modules are designed to be testable. Examples:

```javascript
// test/utils.test.js
import { debounce } from '../src/js/modules/utils';

describe('debounce', () => {
  it('should delay function execution', (done) => {
    let called = false;
    const fn = debounce(() => { called = true; }, 100);
    
    fn();
    expect(called).toBe(false);
    
    setTimeout(() => {
      expect(called).toBe(true);
      done();
    }, 150);
  });
});
```

## Contributing

When adding new modules:

1. Place in appropriate subdirectory
2. Add JSDoc comments
3. Export both named and default exports where appropriate
4. Update this README
5. Add tests if possible
6. Update webpack aliases if needed

## Performance Considerations

- All modules are tree-shakeable (use ES6 imports/exports)
- Heavy computations use `requestIdleCallback` when available
- Observers are cleaned up properly to prevent memory leaks
- Caching strategies prevent unnecessary network requests
- Resource hints optimize loading performance
