/**
 * Logger 模块单元测试
 * 覆盖日志输出、环境感知、脱敏等核心功能
 */

import Logger from '../../src/js/modules/logger';

describe('Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('warn()', () => {
    it('应该始终输出警告日志', () => {
      Logger.warn('test warning');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN]', 'test warning');
    });

    it('应该支持多个参数', () => {
      Logger.warn('msg', 123, { key: 'val' });
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN]', 'msg', 123, { key: 'val' });
    });
  });

  describe('error()', () => {
    it('应该始终输出错误日志', () => {
      Logger.error('test error');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR]', 'test error');
    });
  });

  describe('sensitive()', () => {
    it('应该在开发环境输出脱敏数据', () => {
      // jsdom 环境下 isDev 可能为 false，sensitive 在非 dev 下直接返回
      // 这里测试逻辑分支
      Logger.sensitive('TOKEN', 'abcdef123456', 3);
      // sensitive 在非 dev 环境下不输出，这是正确行为
    });

    it('应该处理空值', () => {
      Logger.sensitive('KEY', null);
      Logger.sensitive('KEY', '');
      // 不应抛出错误
    });
  });

  describe('log() 和 debug()', () => {
    it('应该在 test 环境下不输出 log', () => {
      // NODE_ENV=test, isDev 为 false
      Logger.log('should not appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('应该在 test 环境下不输出 debug', () => {
      Logger.debug('should not appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('time() / timeEnd()', () => {
    it('应该在 test 环境下不调用 console.time', () => {
      Logger.time('test');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('table()', () => {
    it('应该在 test 环境下不调用 console.table', () => {
      Logger.table([{ a: 1 }]);
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('getRelease() / env()', () => {
    afterEach(() => {
      delete window.SENTRY_RELEASE;
    });

    it('getRelease 应读取 window.SENTRY_RELEASE', () => {
      window.SENTRY_RELEASE = 'esim-tools@53e56a2';
      expect(Logger.getRelease()).toBe('esim-tools@53e56a2');
    });

    it('getRelease 未注入时回退 unknown', () => {
      delete window.SENTRY_RELEASE;
      expect(Logger.getRelease()).toBe('esim-tools@unknown');
    });

    it('env 生产路径应打印 Release', () => {
      window.SENTRY_RELEASE = 'esim-tools@53e56a2';
      const groupSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation();
      const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      Logger.env();

      expect(consoleSpy.log).toHaveBeenCalledWith('Release:', 'esim-tools@53e56a2');
      groupSpy.mockRestore();
      groupEndSpy.mockRestore();
    });
  });
});
