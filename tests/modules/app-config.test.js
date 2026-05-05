/**
 * AppConfig 模块单元测试
 * 覆盖环境检测、配置加载、深层合并等核心功能
 */

import { AppConfig, ENV } from '../../src/js/modules/app-config';

describe('AppConfig', () => {
  describe('环境检测', () => {
    it('应该检测为 test 环境', () => {
      const config = new AppConfig();
      // jest.config.js 设置了 NODE_ENV=test
      expect(config.env).toBe('test');
    });
  });

  describe('配置加载', () => {
    it('应该加载基础配置', () => {
      const config = new AppConfig();
      expect(config.get('app.name')).toBe('eSIM Tools');
      expect(config.get('app.version')).toBe('2.0.0');
    });

    it('应该加载 API 配置', () => {
      const config = new AppConfig();
      expect(config.get('api.timeout')).toBeDefined();
      expect(config.get('api.retries')).toBeDefined();
    });

    it('应该加载功能开关', () => {
      const config = new AppConfig();
      expect(config.isFeatureEnabled('giffgaff')).toBe(true);
      expect(config.isFeatureEnabled('simyo')).toBe(true);
    });
  });

  describe('get() 方法', () => {
    it('应该通过点号路径获取嵌套值', () => {
      const config = new AppConfig();
      expect(config.get('security.rateLimit.windowMs')).toBe(60000);
    });

    it('应该在路径不存在时返回默认值', () => {
      const config = new AppConfig();
      expect(config.get('nonexistent.path', 'default')).toBe('default');
    });

    it('应该在路径不存在时返回 null', () => {
      const config = new AppConfig();
      expect(config.get('nonexistent.path')).toBeNull();
    });
  });

  describe('isDevelopment() / isProduction()', () => {
    it('应该正确识别环境', () => {
      const config = new AppConfig();
      // NODE_ENV=test
      expect(config.isDevelopment()).toBe(false);
      expect(config.isProduction()).toBe(false);
    });
  });

  describe('deepMerge()', () => {
    it('应该深层合并对象', () => {
      const config = new AppConfig();
      const target = { a: 1, b: { c: 2, d: 3 } };
      const source = { b: { c: 99 }, e: 4 };
      const result = config.deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: { c: 99, d: 3 }, e: 4 });
    });
  });

  describe('ENV 常量', () => {
    it('应该导出环境常量', () => {
      expect(ENV.DEVELOPMENT).toBe('development');
      expect(ENV.PRODUCTION).toBe('production');
      expect(ENV.TEST).toBe('test');
    });
  });
});
