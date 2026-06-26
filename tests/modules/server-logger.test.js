/**
 * server-logger 模块单元测试
 * 覆盖结构化日志输出、日志级别控制、工厂函数等核心功能
 */

'use strict';

const { createLogger, parseLogLevel, LOG_LEVELS } = require('../../netlify/functions/_shared/server-logger');

describe('server-logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('createLogger', () => {
    it('应该返回具有 info/warn/error/debug 方法的 logger 实例', () => {
      const logger = createLogger('test-fn', 'req-1');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('应该输出 JSON 格式的结构化日志', () => {
      const logger = createLogger('test-fn', 'req-1');
      logger.info('test message');
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.level).toBe('INFO');
      expect(output.message).toBe('test message');
      expect(output.function).toBe('test-fn');
      expect(output.requestId).toBe('req-1');
      expect(output.timestamp).toBeDefined();
    });

    it('应该支持附加 context 字段', () => {
      const logger = createLogger('test-fn', 'req-1');
      logger.info('with context', { status: 200, duration: 42 });
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.status).toBe(200);
      expect(output.duration).toBe(42);
    });

    it('warn 应该输出到 console.warn', () => {
      const logger = createLogger('test-fn', 'req-1');
      logger.warn('warning msg');
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0]);
      expect(output.level).toBe('WARN');
    });

    it('error 应该输出到 console.error', () => {
      const logger = createLogger('test-fn', 'req-1');
      logger.error('error msg', { stack: 'fake stack' });
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(output.level).toBe('ERROR');
      expect(output.stack).toBe('fake stack');
    });

    it('DEBUG 日志在非 DEBUG 环境下应该被抑制', () => {
      const originalLevel = process.env.LOG_LEVEL;
      delete process.env.LOG_LEVEL;
      const logger = createLogger('test-fn', 'req-1');
      logger.debug('debug msg');
      expect(consoleSpy.log).not.toHaveBeenCalled();
      if (originalLevel) process.env.LOG_LEVEL = originalLevel;
    });

    it('DEBUG 日志在 LOG_LEVEL=DEBUG 时应该输出', () => {
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'DEBUG';
      const logger = createLogger('test-fn', 'req-1');
      logger.debug('debug msg');
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.level).toBe('DEBUG');
      expect(output.message).toBe('debug msg');
      if (originalLevel) process.env.LOG_LEVEL = originalLevel;
      else delete process.env.LOG_LEVEL;
    });
  });

  describe('parseLogLevel', () => {
    it('应该解析有效日志级别', () => {
      expect(parseLogLevel('DEBUG')).toBe(0);
      expect(parseLogLevel('INFO')).toBe(1);
      expect(parseLogLevel('WARN')).toBe(2);
      expect(parseLogLevel('ERROR')).toBe(3);
    });

    it('未知级别应该默认为 INFO', () => {
      expect(parseLogLevel('UNKNOWN')).toBe(1);
    });

    it('undefined 应该默认为 INFO', () => {
      expect(parseLogLevel(undefined)).toBe(1);
    });
  });

  describe('LOG_LEVELS', () => {
    it('应该包含四个标准级别', () => {
      expect(LOG_LEVELS).toEqual({ DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 });
    });
  });
});
