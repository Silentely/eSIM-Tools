/**
 * SecureStorage 模块单元测试
 * 覆盖安全存储、TTL 过期、降级存储等核心功能
 */

import secureStorage from '../../src/js/modules/secure-storage';

describe('SecureStorage', () => {
  let store;
  let realStore;

  beforeEach(() => {
    store = secureStorage;
    // 创建真实的内存存储来模拟 sessionStorage 行为
    realStore = {};
    // 用带实际存储行为的 mock 替换 sessionStorage
    const mockStorage = {
      getItem: jest.fn((key) => realStore[key] || null),
      setItem: jest.fn((key, value) => { realStore[key] = value; }),
      removeItem: jest.fn((key) => { delete realStore[key]; }),
      clear: jest.fn(() => { Object.keys(realStore).forEach(k => delete realStore[k]); }),
    };
    store.storage = mockStorage;
    store.fallbackStorage.clear();
  });

  describe('setItem() / getItem()', () => {
    it('应该存储和读取数据', () => {
      store.setItem('key1', 'value1');
      expect(store.storage.setItem).toHaveBeenCalled();
      expect(store.getItem('key1')).toBe('value1');
    });

    it('应该存储对象类型数据', () => {
      const obj = { a: 1, b: 'test' };
      store.setItem('obj', obj);
      expect(store.getItem('obj')).toEqual(obj);
    });

    it('应该在 sessionStorage 不可用时降级到内存存储', () => {
      store.storage = null;
      store.setItem('key', 'value');
      expect(store.fallbackStorage.has('key')).toBe(true);
      expect(store.getItem('key')).toBe('value');
    });

    it('应该在 JSON.stringify 失败时降级到内存存储', () => {
      const circular = {};
      circular.self = circular;
      store.setItem('circular', circular);
      expect(store.fallbackStorage.has('circular')).toBe(true);
    });
  });

  describe('TTL 过期机制', () => {
    it('应该在数据过期后返回 null', () => {
      const expiredData = {
        value: 'old',
        expires: Date.now() - 1000,
        timestamp: Date.now() - 10000
      };
      realStore['expired'] = JSON.stringify(expiredData);

      const result = store.getItem('expired');
      expect(result).toBeNull();
    });

    it('应该在数据未过期时返回值', () => {
      const validData = {
        value: 'fresh',
        expires: Date.now() + 60000,
        timestamp: Date.now()
      };
      realStore['fresh'] = JSON.stringify(validData);
      expect(store.getItem('fresh')).toBe('fresh');
    });

    it('应该使用自定义 TTL', () => {
      store.setItem('short', 'ttl', 1000);
      expect(store.storage.setItem).toHaveBeenCalled();
    });
  });

  describe('removeItem()', () => {
    it('应该从 sessionStorage 移除数据', () => {
      store.removeItem('key');
      expect(store.storage.removeItem).toHaveBeenCalledWith('key');
    });

    it('应该从 fallbackStorage 移除数据', () => {
      store.storage = null;
      store.setItem('key', 'value');
      store.removeItem('key');
      expect(store.fallbackStorage.has('key')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('应该清除所有数据', () => {
      store.clear();
      expect(store.storage.clear).toHaveBeenCalled();
      expect(store.fallbackStorage.size).toBe(0);
    });
  });

  describe('has()', () => {
    it('应该返回 true 如果数据存在', () => {
      const validData = {
        value: 'exists',
        expires: Date.now() + 60000,
        timestamp: Date.now()
      };
      realStore['exists'] = JSON.stringify(validData);
      expect(store.has('exists')).toBe(true);
    });

    it('应该返回 false 如果数据不存在', () => {
      expect(store.has('nope')).toBe(false);
    });
  });

  describe('getItem() 异常处理', () => {
    it('应该在 JSON.parse 失败时返回 null', () => {
      realStore['bad'] = 'invalid json{{{';
      expect(store.getItem('bad')).toBeNull();
    });
  });
});
