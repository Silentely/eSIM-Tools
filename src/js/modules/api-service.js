import Logger from './logger.js';

/**
 * API Service Layer - Provides a consistent interface for API calls
 * with built-in retry, caching, and error handling
 */

import { retry, safeJsonParse } from './utils';

class APIService {
  constructor(config = {}) {
    this.baseURL = config.baseURL || '';
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
    this.cache = new Map();
    this.pendingRequests = new Map(); // Request deduplication
  }

  /**
   * Make an HTTP request with retry and caching
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    const cacheKey = this.getCacheKey(url, method, options.body);

    // Check cache for GET requests
    if (method === 'GET' && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < (options.cacheTime || 300000)) {
        Logger.log(`[API] Cache hit: ${endpoint}`);
        return cached.data;
      }
    }

    // Deduplicate concurrent identical requests
    if (this.pendingRequests.has(cacheKey)) {
      Logger.log(`[API] Deduplicating request: ${endpoint}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Create request promise
    const requestPromise = this.executeRequest(url, options);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const data = await requestPromise;

      // Cache GET requests
      if (method === 'GET') {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }

      return data;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Execute the actual HTTP request with retry
   */
  async executeRequest(url, options) {
    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: this.createTimeoutSignal(options.timeout || this.timeout)
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    return retry(async () => {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }

      return response.text();
    }, this.retries);
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Create cache key from request params
   */
  getCacheKey(url, method, body) {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyStr}`;
  }

  /**
   * Create an AbortController signal with timeout
   */
  createTimeoutSignal(timeout) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(endpoint) {
    const keysToDelete = [];
    for (const [key] of this.cache.entries()) {
      if (key.includes(endpoint)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

/**
 * Create service instances for different providers
 */
export const giffgaffAPI = new APIService({
  baseURL: '/.netlify/functions',
  timeout: 30000,
  retries: 3
});

export const simyoAPI = new APIService({
  baseURL: '/api/simyo',
  timeout: 30000,
  retries: 3
});

export default APIService;
