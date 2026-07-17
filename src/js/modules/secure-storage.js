import Logger from './logger.js';

/**
 * 安全存储工具模块
 * 使用 sessionStorage 替代 localStorage，并添加过期时间机制
 * 防御 XSS 攻击窃取敏感数据
 */

/**
 * 安全探测 Web Storage API 可用性
 * 在跨域 iframe、sandbox 上下文或用户禁用存储时，
 * 直接读取 sessionStorage/localStorage 属性可能抛出 SecurityError，
 * typeof 检查无法安全拦截此类异常。
 * @param {'sessionStorage'|'localStorage'} kind - 存储类型
 * @returns {Storage|null} 可用的存储对象，或 null
 */
function safeGetStorage(kind) {
  try {
    const storage = window[kind];
    // 写入测试：某些浏览器在隐身模式下返回对象但实际拒绝读写
    const testKey = `__storage_test_${kind}__`;
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return storage;
  } catch (e) {
    return null;
  }
}

class SecureStorage {
  constructor() {
    // 优先使用 sessionStorage (关闭浏览器即清除)
    // 若需跨标签页共享，可使用 localStorage，但必须加过期时间
    this.storage = safeGetStorage('sessionStorage');
    this.fallbackStorage = new Map(); // 内存降级
  }

  /**
   * 设置带过期时间的数据
   * @param {string} key - 键名
   * @param {any} value - 值
   * @param {number} ttl - 过期时间(毫秒)，默认1小时
   */
  setItem(key, value, ttl = 3600000) {
    const data = {
      value,
      expires: Date.now() + ttl,
      timestamp: Date.now()
    };

    try {
      const serialized = JSON.stringify(data);
      if (this.storage) {
        this.storage.setItem(key, serialized);
      } else {
        this.fallbackStorage.set(key, data);
      }
    } catch (error) {
      Logger.error('[SecureStorage] setItem failed:', error.message);
      // 降级到内存存储
      this.fallbackStorage.set(key, data);
    }
  }

  /**
   * 获取数据，自动检查过期时间
   * @param {string} key - 键名
   * @returns {any|null} 未过期的值，或 null
   */
  getItem(key) {
    try {
      let data;

      if (this.storage) {
        const serialized = this.storage.getItem(key);
        if (!serialized) return null;
        data = JSON.parse(serialized);
      } else {
        data = this.fallbackStorage.get(key);
        if (!data) return null;
      }

      // 检查过期时间
      if (data.expires && Date.now() > data.expires) {
        this.removeItem(key);
        return null;
      }

      return data.value;
    } catch (error) {
      Logger.error('[SecureStorage] getItem failed:', error.message);
      return null;
    }
  }

  /**
   * 移除数据
   * @param {string} key - 键名
   */
  removeItem(key) {
    try {
      if (this.storage) {
        this.storage.removeItem(key);
      }
      this.fallbackStorage.delete(key);
    } catch (error) {
      Logger.error('[SecureStorage] removeItem failed:', error.message);
    }
  }

  /**
   * 清除所有数据
   */
  clear() {
    try {
      if (this.storage) {
        this.storage.clear();
      }
      this.fallbackStorage.clear();
    } catch (error) {
      Logger.error('[SecureStorage] clear failed:', error.message);
    }
  }

  /**
   * 检查数据是否存在且未过期
   * @param {string} key - 键名
   * @returns {boolean}
   */
  has(key) {
    return this.getItem(key) !== null;
  }

  /**
   * 迁移 localStorage 中的旧数据到 sessionStorage
   * @param {string} key - 键名
   */
  migrateFromLocalStorage(key) {
    try {
      const local = safeGetStorage('localStorage');
      if (!local) return;

      const oldValue = local.getItem(key);
      if (oldValue) {
        // 迁移数据（不带过期时间，视为短期数据）
        this.setItem(key, oldValue, 1800000); // 30分钟
        // 清除旧数据
        local.removeItem(key);
        Logger.log(`[SecureStorage] Migrated ${key} from localStorage`);
      }
    } catch (error) {
      Logger.error('[SecureStorage] Migration failed:', error.message);
    }
  }

  /**
   * 批量迁移旧数据
   * @param {string[]} keys - 键名数组
   */
  migrateAll(keys) {
    keys.forEach(key => this.migrateFromLocalStorage(key));
  }
}

// 导出单例
const secureStorage = new SecureStorage();

// 自动迁移已知的敏感数据键
// 顶层执行必须包裹 try-catch，防止受限上下文（iframe/sandbox/隐私设置）
// 导致 sessionStorage/localStorage 访问异常未被捕获
try {
  if (typeof window !== 'undefined') {
    const SENSITIVE_KEYS = [
      'giffgaff_cookie',
      'gg_esim_activationCode',
      'gg_esim_lpa',
      'gg_esim_iccid',
      'gg_esim_eid',
      'gg_access_token'
    ];

    // 页面加载时自动迁移
    secureStorage.migrateAll(SENSITIVE_KEYS);
  }
} catch (e) {
  // 降级到内存存储，模块仍可正常使用
  Logger.warn('[SecureStorage] Module-level initialization failed:', e.message);
}

export default secureStorage;
