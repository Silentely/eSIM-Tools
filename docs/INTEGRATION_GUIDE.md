# Integration Guide: Using the New Modules

This guide shows how to integrate the new performance and utility modules into your application.

## Quick Start

### 1. Basic Setup

```javascript
// main.js or your entry point
import performanceMonitor from '@modules/performance-monitor';
import resourceHints from '@modules/resource-hints';
import appConfig from '@modules/app-config';

// Initialize monitoring (automatic)
// performanceMonitor is already initialized

// Initialize resource hints (automatic)
// resourceHints is already initialized

console.log('App environment:', appConfig.isDevelopment() ? 'development' : 'production');
```

### 2. Using API Service

Replace direct `fetch` calls with the API service:

#### Before:
```javascript
async function fetchUserData() {
  try {
    const response = await fetch('/api/user');
    if (!response.ok) throw new Error('Failed');
    return await response.json();
  } catch (error) {
    console.error(error);
  }
}
```

#### After:
```javascript
import { giffgaffAPI } from '@modules/api-service';

async function fetchUserData() {
  // Automatic retry, caching, and error handling
  return await giffgaffAPI.get('/giffgaff-graphql');
}
```

### 3. Performance Monitoring Integration

#### Track Custom Operations:
```javascript
import performanceMonitor from '@modules/performance-monitor';

async function performExpensiveOperation() {
  performanceMonitor.startMark('expensive-operation');
  
  // Your code here
  await someAsyncWork();
  
  performanceMonitor.endMark('expensive-operation');
}
```

#### View Performance Report:
```javascript
// In development, check performance metrics
if (appConfig.isDevelopment()) {
  window.showPerformanceReport = () => {
    const report = performanceMonitor.generateReport();
    console.table(report.metrics);
  };
}
```

### 4. Resource Optimization

#### Preload Critical Resources:
```javascript
import resourceHints from '@modules/resource-hints';

// Preload the next page users are likely to visit
resourceHints.addPrefetch('/giffgaff');

// Preconnect to API early
resourceHints.addPreconnect('https://api.giffgaff.com');
```

## Real-World Examples

### Example 1: Optimized Form Submission

```javascript
import { giffgaffAPI } from '@modules/api-service';
import { debounce } from '@utils';
import performanceMonitor from '@modules/performance-monitor';

class OptimizedForm {
  constructor(formElement) {
    this.form = formElement;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Debounce search input
    const searchInput = this.form.querySelector('#search');
    if (searchInput) {
      searchInput.addEventListener('input', 
        debounce((e) => this.handleSearch(e.target.value), 300)
      );
    }

    // Track form submission
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async handleSearch(query) {
    if (!query) return;

    performanceMonitor.startMark('search-request');
    
    try {
      // API call with automatic caching
      const results = await giffgaffAPI.get(`/search?q=${encodeURIComponent(query)}`);
      this.displayResults(results);
    } catch (error) {
      this.showError('Search failed');
    } finally {
      performanceMonitor.endMark('search-request');
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    performanceMonitor.startMark('form-submit');
    
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData.entries());

    try {
      const result = await giffgaffAPI.post('/submit', data);
      this.showSuccess(result);
    } catch (error) {
      this.showError('Submission failed');
    } finally {
      performanceMonitor.endMark('form-submit');
    }
  }

  displayResults(results) {
    // Implementation
  }

  showSuccess(message) {
    // Implementation
  }

  showError(message) {
    // Implementation
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#my-form');
  if (form) {
    new OptimizedForm(form);
  }
});
```

### Example 2: Optimized Image Gallery

```javascript
import resourceHints from '@modules/resource-hints';
import { throttle } from '@utils';

class ImageGallery {
  constructor(containerElement) {
    this.container = containerElement;
    this.images = [];
    this.setupIntersectionObserver();
    this.setupPrefetching();
  }

  setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '50px' // Load before entering viewport
    });

    this.container.querySelectorAll('img[data-src]').forEach(img => {
      observer.observe(img);
    });
  }

  setupPrefetching() {
    // Prefetch full-size images when thumbnails are hovered
    this.container.addEventListener('mouseover', 
      throttle((e) => {
        if (e.target.tagName === 'IMG') {
          const fullSizeUrl = e.target.dataset.fullsize;
          if (fullSizeUrl) {
            resourceHints.addPrefetch(fullSizeUrl, 'image');
          }
        }
      }, 200)
    );
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.classList.add('loaded');
      img.removeAttribute('data-src');
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const gallery = document.querySelector('.image-gallery');
  if (gallery) {
    new ImageGallery(gallery);
  }
});
```

### Example 3: Configuration-Based Feature Toggles

```javascript
import appConfig from '@modules/app-config';

class AnalyticsService {
  constructor() {
    this.enabled = appConfig.isFeatureEnabled('analytics');
    if (this.enabled) {
      this.initialize();
    }
  }

  initialize() {
    // Only load analytics in production
    if (appConfig.isProduction()) {
      this.loadAnalyticsScript();
    }
  }

  trackEvent(eventName, data) {
    if (!this.enabled) return;
    
    console.log('Track event:', eventName, data);
    // Send to analytics service
  }

  trackPageView(path) {
    if (!this.enabled) return;
    
    console.log('Track page view:', path);
    // Send to analytics service
  }

  loadAnalyticsScript() {
    // Load analytics script dynamically
  }
}

class ErrorReportingService {
  constructor() {
    this.enabled = appConfig.isFeatureEnabled('errorReporting');
    if (this.enabled) {
      this.initialize();
    }
  }

  initialize() {
    window.addEventListener('error', (e) => this.handleError(e));
    window.addEventListener('unhandledrejection', (e) => this.handleRejection(e));
  }

  handleError(error) {
    if (!this.enabled) return;
    
    console.error('Captured error:', error);
    // Send to error reporting service (e.g., Sentry)
  }

  handleRejection(event) {
    if (!this.enabled) return;
    
    console.error('Unhandled rejection:', event.reason);
    // Send to error reporting service
  }
}

// Export services
export const analytics = new AnalyticsService();
export const errorReporting = new ErrorReportingService();
```

### Example 4: Advanced API Usage with Retry

```javascript
import { retry } from '@utils';
import { giffgaffAPI } from '@modules/api-service';
import performanceMonitor from '@modules/performance-monitor';

class ESIMActivationService {
  async activateESIM(data) {
    performanceMonitor.startMark('esim-activation');
    
    try {
      // Retry up to 5 times with exponential backoff
      const result = await retry(
        () => giffgaffAPI.post('/giffgaff-mfa-challenge', data),
        5,  // max retries
        2000 // initial delay (2s)
      );

      performanceMonitor.endMark('esim-activation');
      return result;
    } catch (error) {
      performanceMonitor.endMark('esim-activation');
      throw new Error(`Activation failed after retries: ${error.message}`);
    }
  }

  async checkStatus(activationId) {
    // Use cached response if available
    return await giffgaffAPI.get(
      `/status?id=${activationId}`,
      { cacheTime: 5000 } // Cache for 5 seconds
    );
  }
}

export default new ESIMActivationService();
```

## Performance Monitoring Dashboard

Add a simple dashboard to view metrics in development:

```javascript
// performance-dashboard.js
import performanceMonitor from '@modules/performance-monitor';
import appConfig from '@modules/app-config';

if (appConfig.isDevelopment()) {
  class PerformanceDashboard {
    constructor() {
      this.createDashboard();
      this.updateInterval = setInterval(() => this.update(), 1000);
    }

    createDashboard() {
      const dashboard = document.createElement('div');
      dashboard.id = 'perf-dashboard';
      dashboard.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 10000;
        max-width: 300px;
      `;
      document.body.appendChild(dashboard);
      this.dashboard = dashboard;
    }

    update() {
      const metrics = performanceMonitor.getMetrics();
      let html = '<strong>Performance Metrics</strong><br>';
      
      for (const [name, data] of Object.entries(metrics)) {
        if (data.value !== undefined) {
          const color = this.getColor(data.rating);
          html += `${name}: <span style="color: ${color}">${Math.round(data.value)}ms</span><br>`;
        }
      }
      
      this.dashboard.innerHTML = html;
    }

    getColor(rating) {
      const colors = {
        'good': '#4caf50',
        'needs-improvement': '#ff9800',
        'poor': '#f44336'
      };
      return colors[rating] || '#fff';
    }

    destroy() {
      clearInterval(this.updateInterval);
      if (this.dashboard) {
        this.dashboard.remove();
      }
    }
  }

  // Initialize dashboard
  window.perfDashboard = new PerformanceDashboard();
}
```

## Testing Integration

Example test using the new modules:

```javascript
// __tests__/api-service.test.js
import APIService from '../src/js/modules/api-service';

describe('APIService', () => {
  let api;

  beforeEach(() => {
    api = new APIService({ baseURL: 'https://api.example.com' });
  });

  afterEach(() => {
    api.clearCache();
  });

  test('should cache GET requests', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' })
      });

    // First call
    await api.get('/data');
    
    // Second call (should use cache)
    const result = await api.get('/data');

    // Fetch should only be called once
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: 'test' });
  });

  test('should retry on failure', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'success' })
      });

    const result = await api.get('/data');

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ data: 'success' });
  });
});
```

## Migration Checklist

When integrating these modules into an existing codebase:

- [ ] Replace direct `fetch` calls with API service
- [ ] Add performance marks for critical operations
- [ ] Configure resource hints for your application
- [ ] Set up feature flags in app-config
- [ ] Add debounce/throttle to event handlers
- [ ] Implement retry logic for critical API calls
- [ ] Set up error boundaries
- [ ] Add performance monitoring dashboard (dev only)
- [ ] Update tests to use new utilities
- [ ] Configure webpack aliases
- [ ] Update documentation

## Best Practices Summary

1. **Always use the API service** instead of direct fetch
2. **Monitor critical paths** with performance marks
3. **Debounce user inputs** (especially search)
4. **Throttle scroll handlers** with RAF throttle
5. **Prefetch likely next pages** for better UX
6. **Use feature flags** for gradual rollouts
7. **Implement retry logic** for important operations
8. **Clean up observers** to prevent memory leaks
9. **Cache wisely** - use appropriate cache times
10. **Test with new utilities** for better maintainability

## Troubleshooting

### Module not found
Make sure webpack aliases are configured in `webpack.config.js`:
```javascript
resolve: {
  alias: {
    '@modules': path.resolve(__dirname, 'src/js/modules'),
    '@utils': path.resolve(__dirname, 'src/js/modules/utils')
  }
}
```

### Performance metrics not showing
Check that the PerformanceObserver API is supported:
```javascript
if ('PerformanceObserver' in window) {
  // Supported
}
```

### Cache not working
Ensure you're using GET requests for cacheable endpoints:
```javascript
// Cacheable
await api.get('/data');

// Not cacheable (by default)
await api.post('/data', body);
```

## Further Reading

- [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) - High-level architecture
- [src/js/modules/README.md](./README.md) - Module documentation
- [Web Vitals](https://web.dev/vitals/) - Google's Core Web Vitals
- [Resource Hints](https://www.w3.org/TR/resource-hints/) - W3C Specification
