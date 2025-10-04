/**
 * Application Configuration Manager
 * Centralized configuration management with environment-specific settings
 */

const ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test'
};

class AppConfig {
  constructor() {
    this.env = this.detectEnvironment();
    this.config = this.loadConfig();
  }

  /**
   * Detect current environment
   */
  detectEnvironment() {
    if (typeof process !== 'undefined' && process.env.NODE_ENV) {
      return process.env.NODE_ENV;
    }

    // Browser environment detection
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return ENV.DEVELOPMENT;
      }
      
      if (hostname.includes('netlify.app') || hostname.includes('deploy-preview')) {
        return ENV.DEVELOPMENT;
      }
    }

    return ENV.PRODUCTION;
  }

  /**
   * Load environment-specific configuration
   */
  loadConfig() {
    const baseConfig = {
      app: {
        name: 'eSIM Tools',
        version: '2.0.0',
        description: '专为Giffgaff和Simyo用户设计的eSIM管理工具集'
      },
      api: {
        timeout: 30000,
        retries: 3,
        retryDelay: 1000
      },
      performance: {
        enableMonitoring: true,
        enableServiceWorker: true,
        swDelay: 2000,
        imageLazyLoadThreshold: '50px',
        maxConcurrentRequests: 4
      },
      cache: {
        version: 'v1',
        staticAssets: {
          maxAge: 31536000,
          immutable: true
        },
        apiResponses: {
          maxAge: 300,
          maxEntries: 100
        },
        images: {
          maxAge: 86400,
          maxEntries: 50
        }
      },
      features: {
        giffgaff: true,
        simyo: true,
        offlineMode: true,
        analytics: false,
        errorReporting: false
      },
      security: {
        enableCSP: true,
        enableCORS: true,
        rateLimit: {
          windowMs: 60000,
          maxRequests: 100
        }
      }
    };

    // Environment-specific overrides
    const envConfig = {
      [ENV.DEVELOPMENT]: {
        api: {
          baseURL: 'http://localhost:3000',
          timeout: 60000
        },
        performance: {
          enableServiceWorker: false
        },
        logging: {
          level: 'debug',
          console: true
        }
      },
      [ENV.PRODUCTION]: {
        api: {
          baseURL: 'https://esim.cosr.eu.org'
        },
        features: {
          analytics: true,
          errorReporting: true
        },
        logging: {
          level: 'error',
          console: false
        }
      },
      [ENV.TEST]: {
        api: {
          timeout: 5000
        },
        performance: {
          enableMonitoring: false,
          enableServiceWorker: false
        }
      }
    };

    return this.deepMerge(baseConfig, envConfig[this.env] || {});
  }

  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  get(path, defaultValue = null) {
    const keys = path.split('.');
    let value = this.config;
    for (const key of keys) {
      if (value && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }
    return value;
  }

  isFeatureEnabled(feature) {
    return this.get(`features.${feature}`, false);
  }

  isDevelopment() {
    return this.env === ENV.DEVELOPMENT;
  }

  isProduction() {
    return this.env === ENV.PRODUCTION;
  }
}

const appConfig = new AppConfig();

export default appConfig;
export { AppConfig, ENV };
