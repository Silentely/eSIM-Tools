/**
 * server-logger 模块单元测试
 * 覆盖日志输出格式、日志级别控制、工厂函数等核心功能
 *
 * 输出格式: [LEVEL] [function] [requestId] message | key=value key=value
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

    it('应该输出人类可读格式的日志', () => {
      const logger = createLogger('test-fn', 'req-1');
      logger.info('test message');
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toBe('[INFO] [test-fn] [req-1] test message');
    });

    it('应该支持附加 context 字段（key=value 格式）', () => {
      const logger = createLogger('test-fn', 'req-1');
      logger.info('with context', { status: 200, duration: 42 });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('[INFO] [test-fn] [req-1] with context');
      expect(output).toContain('status=200');
      expect(output).toContain('duration=42');
      expect(output).toContain(' | ');
    });

    it('无 context 时不应包含分隔符 |', () => {
      const logger = createLogger('test-fn', 'req-1');
      logger.info('no context');
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).not.toContain(' | ');
    });

    it('context 为 null 或 undefined 时不应报错', () => {
      const logger = createLogger('test-fn', 'req-1');
      expect(() => logger.info('msg', null)).not.toThrow();
      expect(() => logger.info('msg', undefined)).not.toThrow();
      expect(() => logger.warn('msg', null)).not.toThrow();
      expect(() => logger.error('msg', null)).not.toThrow();
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('[INFO] [test-fn] [req-1] msg');
    });

    it('warn 应该输出到 console.warn', () => {
      const logger = createLogger('test-fn', 'req-1');
      logger.warn('warning msg');
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const output = consoleSpy.warn.mock.calls[0][0];
      expect(output).toContain('[WARN]');
      expect(output).toContain('warning msg');
    });

    it('error 应该输出到 console.error', () => {
      const logger = createLogger('test-fn', 'req-1');
      logger.error('error msg', { stack: 'fake stack' });
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const output = consoleSpy.error.mock.calls[0][0];
      expect(output).toContain('[ERROR]');
      expect(output).toContain('error msg');
      expect(output).toContain('stack=fake stack');
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
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('[DEBUG]');
      expect(output).toContain('debug msg');
      if (originalLevel) process.env.LOG_LEVEL = originalLevel;
      else delete process.env.LOG_LEVEL;
    });

    it('LOG_LEVEL=ERROR 时应该抑制 INFO 和 WARN', () => {
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'ERROR';
      const logger = createLogger('test-fn', 'req-1');
      logger.info('should not appear');
      logger.warn('should not appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      // ERROR 仍然输出
      logger.error('should appear');
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      if (originalLevel) process.env.LOG_LEVEL = originalLevel;
      else delete process.env.LOG_LEVEL;
    });

    it('LOG_LEVEL=WARN 时应该抑制 INFO 和 DEBUG', () => {
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'WARN';
      const logger = createLogger('test-fn', 'req-1');
      logger.info('should not appear');
      logger.debug('should not appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
      // WARN 和 ERROR 仍然输出
      logger.warn('should appear');
      logger.error('should appear');
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      if (originalLevel) process.env.LOG_LEVEL = originalLevel;
      else delete process.env.LOG_LEVEL;
    });

    it('多个 logger 实例应该互不干扰', () => {
      const logger1 = createLogger('fn-a', 'req-1');
      const logger2 = createLogger('fn-b', 'req-2');
      logger1.info('from a');
      logger2.info('from b');
      const out1 = consoleSpy.log.mock.calls[0][0];
      const out2 = consoleSpy.log.mock.calls[1][0];
      expect(out1).toContain('[fn-a]');
      expect(out1).toContain('[req-1]');
      expect(out2).toContain('[fn-b]');
      expect(out2).toContain('[req-2]');
    });

    it('日志格式应该方便用户复制（一行一条）', () => {
      const logger = createLogger('giffgaff-graphql', 'abc-123');
      logger.info('calling_upstream', { operationName: 'getESims', isSwap: false });
      const output = consoleSpy.log.mock.calls[0][0];
      // 确认是单行、无换行符、包含所有关键信息
      expect(output).not.toContain('\n');
      expect(output).toBe('[INFO] [giffgaff-graphql] [abc-123] calling_upstream | operationName=getESims isSwap=false');
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
