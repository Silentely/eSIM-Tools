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
Centralized API service with built-in retry, caching, and request deduplication.

**Features:**
- Automatic retry on failure
- Request/response caching
- Request deduplication for concurrent identical requests
- Timeout handling
- GET, POST, PUT, DELETE methods

**Usage:**
```javascript
import { giffgaffAPI, simyoAPI } from '@modules/api-service';

// With automatic retry and caching
const data = await giffgaffAPI.get('/giffgaff-graphql');

// POST request
await simyoAPI.post('/activate', { phone: '123456789' });

// Clear cache
giffgaffAPI.clearCache();
```

#### `resource-hints.js`
Manages preconnect, preload, prefetch for optimal resource loading.

**Features:**
- Automatic preconnect to critical origins
- DNS prefetch for non-critical resources
- Intersection observer-based prefetching
- Idle-time prefetching
- Dynamic resource hint management

**Usage:**
```javascript
import resourceHints from '@modules/resource-hints';

// Add dynamic preconnect
resourceHints.addPreconnect('https://api.example.com');

// Preload critical CSS
resourceHints.preloadCSS('/critical.css');

// Add prefetch
resourceHints.addPrefetch('/next-page');
```

### Performance

#### `performance-monitor.js`
Tracks and reports Core Web Vitals and custom performance metrics.

**Features:**
- Core Web Vitals: LCP, FID, CLS, FCP, TTFB
- Navigation timing metrics
- Custom timing marks and measures
- Performance rating (good/needs-improvement/poor)
- Analytics integration ready

**Usage:**
```javascript
import performanceMonitor from '@modules/performance-monitor';

// Custom timing
performanceMonitor.startMark('data-fetch');
await fetchData();
performanceMonitor.endMark('data-fetch');

// Get all metrics
const metrics = performanceMonitor.getMetrics();

// Generate report
const report = performanceMonitor.generateReport();
```

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
