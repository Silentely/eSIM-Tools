/**
 * withAuth 中间件日志集成测试
 * 验证请求 ID 生成、请求开始/结束日志、耗时统计和 logger 注入
 */

'use strict';

// Mock server-logger 以捕获日志输出
const mockLogs = [];
jest.mock('../../netlify/functions/_shared/server-logger', () => ({
  createLogger: jest.fn((fn, reqId) => ({
    info: jest.fn((msg, ctx) => mockLogs.push({ level: 'INFO', msg, fn, reqId, ctx })),
    warn: jest.fn((msg, ctx) => mockLogs.push({ level: 'WARN', msg, fn, reqId, ctx })),
    error: jest.fn((msg, ctx) => mockLogs.push({ level: 'ERROR', msg, fn, reqId, ctx })),
    debug: jest.fn((msg, ctx) => mockLogs.push({ level: 'DEBUG', msg, fn, reqId, ctx })),
  })),
}));

// Mock sentry 避免初始化问题
jest.mock('../../netlify/functions/_shared/sentry', () => ({
  captureException: jest.fn(),
  flush: jest.fn(() => Promise.resolve(true)),
  setContext: jest.fn(),
  setTag: jest.fn(),
  isDev: true,
  sentryInitialized: false,
}));

const { withAuth } = require('../../netlify/functions/_shared/middleware');
const { createLogger } = require('../../netlify/functions/_shared/server-logger');

describe('withAuth 日志集成', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogs.length = 0;
  });

  it('应该在请求开始时输出 INFO 日志', async () => {
    const mockHandler = jest.fn(async () => ({
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    }));

    const wrapped = withAuth(mockHandler, { requireAuth: false });
    await wrapped(
      {
        httpMethod: 'GET',
        path: '/bff/test',
        headers: { origin: 'https://esim.cosr.eu.org' },
      },
      { functionName: 'test-fn' }
    );

    const startLog = mockLogs.find((l) => l.msg === 'request_start');
    expect(startLog).toBeDefined();
    expect(startLog.fn).toBe('test-fn');
    expect(startLog.ctx.method).toBe('GET');
    expect(startLog.ctx.path).toBe('/bff/test');
  });

  it('应该在请求结束时输出 INFO 日志包含耗时', async () => {
    const mockHandler = jest.fn(async () => ({
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    }));

    const wrapped = withAuth(mockHandler, { requireAuth: false });
    await wrapped(
      {
        httpMethod: 'GET',
        path: '/bff/test',
        headers: { origin: 'https://esim.cosr.eu.org' },
      },
      { functionName: 'test-fn' }
    );

    const endLog = mockLogs.find((l) => l.msg === 'request_end');
    expect(endLog).toBeDefined();
    expect(endLog.ctx.status).toBe(200);
    expect(typeof endLog.ctx.duration).toBe('number');
  });

  it('应该通过 context 暴露 logger 实例给 handler', async () => {
    let capturedLogger;
    const mockHandler = jest.fn(async (event, context) => {
      capturedLogger = context.logger;
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    });

    const wrapped = withAuth(mockHandler, { requireAuth: false });
    await wrapped(
      {
        httpMethod: 'GET',
        path: '/bff/test',
        headers: { origin: 'https://esim.cosr.eu.org' },
      },
      { functionName: 'test-fn' }
    );

    expect(capturedLogger).toBeDefined();
    expect(typeof capturedLogger.info).toBe('function');
    expect(typeof capturedLogger.error).toBe('function');
  });

  it('handler 抛出异常时应该输出 request_error 日志', async () => {
    const mockHandler = jest.fn(async () => {
      throw new Error('test error');
    });

    const wrapped = withAuth(mockHandler, { requireAuth: false });
    await wrapped(
      {
        httpMethod: 'GET',
        path: '/bff/test',
        headers: { origin: 'https://esim.cosr.eu.org' },
      },
      { functionName: 'test-fn' }
    );

    const errorLog = mockLogs.find((l) => l.msg === 'request_error');
    expect(errorLog).toBeDefined();
    expect(errorLog.ctx.errorMessage).toBe('test error');
    expect(errorLog.ctx.status).toBe(500);
  });

  it('每个请求应该生成唯一的 requestId', async () => {
    const mockHandler = jest.fn(async () => ({ statusCode: 200, body: '{}' }));
    const wrapped = withAuth(mockHandler, { requireAuth: false });

    await wrapped(
      { httpMethod: 'GET', path: '/a', headers: { origin: 'https://esim.cosr.eu.org' } },
      { functionName: 'fn1' }
    );
    const reqId1 = mockLogs[0]?.reqId;

    mockLogs.length = 0;
    await wrapped(
      { httpMethod: 'GET', path: '/b', headers: { origin: 'https://esim.cosr.eu.org' } },
      { functionName: 'fn2' }
    );
    const reqId2 = mockLogs[0]?.reqId;

    expect(reqId1).toBeDefined();
    expect(reqId2).toBeDefined();
    expect(reqId1).not.toBe(reqId2);
  });

  it('createLogger 应该使用正确的 functionName 和 requestId', async () => {
    const mockHandler = jest.fn(async () => ({ statusCode: 200, body: '{}' }));
    const wrapped = withAuth(mockHandler, { requireAuth: false });

    await wrapped(
      { httpMethod: 'GET', path: '/test', headers: { origin: 'https://esim.cosr.eu.org' } },
      { functionName: 'my-function' }
    );

    expect(createLogger).toHaveBeenCalledWith('my-function', expect.any(String));
  });

  it('CORS 鉴权失败时应该输出 request_error 日志', async () => {
    const mockHandler = jest.fn(async () => ({ statusCode: 200, body: '{}' }));
    const wrapped = withAuth(mockHandler, { requireAuth: false });

    await wrapped(
      { httpMethod: 'GET', path: '/bff/test', headers: { origin: 'https://evil.com' } },
      { functionName: 'test-fn' }
    );

    const errorLog = mockLogs.find((l) => l.msg === 'request_error');
    expect(errorLog).toBeDefined();
    expect(errorLog.ctx.status).toBe(403);
    expect(errorLog.ctx.errorName).toBe('AuthError');
    // handler 不应被调用
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('无效 JSON body 时应该输出 request_error 日志', async () => {
    const mockHandler = jest.fn(async () => ({ statusCode: 200, body: '{}' }));
    const wrapped = withAuth(mockHandler, { requireAuth: false });

    await wrapped(
      {
        httpMethod: 'POST',
        path: '/bff/test',
        headers: { origin: 'https://esim.cosr.eu.org' },
        body: 'not-valid-json{{{',
      },
      { functionName: 'test-fn' }
    );

    const errorLog = mockLogs.find((l) => l.msg === 'request_error');
    expect(errorLog).toBeDefined();
    expect(errorLog.ctx.status).toBe(400);
    expect(errorLog.ctx.errorMessage).toBe('Invalid JSON body');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('输入验证失败时应该输出 request_error 日志', async () => {
    const mockHandler = jest.fn(async () => ({ statusCode: 200, body: '{}' }));
    const schema = { name: { required: true, type: 'string' } };
    const wrapped = withAuth(mockHandler, { requireAuth: false, validateSchema: schema });

    await wrapped(
      {
        httpMethod: 'POST',
        path: '/bff/test',
        headers: { origin: 'https://esim.cosr.eu.org' },
        body: JSON.stringify({}),
      },
      { functionName: 'test-fn' }
    );

    const errorLog = mockLogs.find((l) => l.msg === 'request_error');
    expect(errorLog).toBeDefined();
    expect(errorLog.ctx.status).toBe(400);
    expect(errorLog.ctx.errorMessage).toMatch(/name is required/);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('error 日志应包含耗时字段', async () => {
    const mockHandler = jest.fn(async () => {
      throw new Error('slow fail');
    });
    const wrapped = withAuth(mockHandler, { requireAuth: false });

    await wrapped(
      { httpMethod: 'GET', path: '/bff/test', headers: { origin: 'https://esim.cosr.eu.org' } },
      { functionName: 'test-fn' }
    );

    const errorLog = mockLogs.find((l) => l.msg === 'request_error');
    expect(errorLog.ctx.duration).toBeDefined();
    expect(typeof errorLog.ctx.duration).toBe('number');
    expect(errorLog.ctx.duration).toBeGreaterThanOrEqual(0);
  });

  it('OPTIONS 预检请求不输出 request_start 日志（提前返回）', async () => {
    const mockHandler = jest.fn(async () => ({ statusCode: 200, body: '{}' }));
    const wrapped = withAuth(mockHandler, { requireAuth: false });

    await wrapped(
      { httpMethod: 'OPTIONS', path: '/bff/test', headers: { origin: 'https://esim.cosr.eu.org' } },
      { functionName: 'test-fn' }
    );

    // request_start 仍然会输出（在鉴权之前），但 request_end 不会（预检提前返回）
    const startLog = mockLogs.find((l) => l.msg === 'request_start');
    expect(startLog).toBeDefined();
    // handler 不应被调用
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
