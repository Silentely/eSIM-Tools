'use strict';

/**
 * qrcode-generate Function 单元测试
 */

// 必须在 require 函数文件前 Mock qrcode 模块
jest.mock('qrcode', () => ({
  toDataURL: jest.fn()
}), { virtual: true });

const QRCode = require('qrcode');

describe('qrcode-generate Function', () => {
  const originalEnv = process.env;
  let qrcodeGenerate;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      ACCESS_KEY: 'test-access-key',
      ALLOWED_ORIGIN: 'https://esim.cosr.eu.org'
    };

    qrcodeGenerate = require('../../netlify/functions/qrcode-generate');
  });

  beforeEach(() => {
    // 重置 Mock 计数器和实现
    QRCode.toDataURL.mockClear();
    QRCode.toDataURL.mockResolvedValue('data:image/png;base64,qrcode');
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('有效请求应该返回 base64 PNG data URL', async () => {
    const result = await qrcodeGenerate.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: JSON.stringify({ data: 'LPA:1$example', size: 300 }),
      queryStringParameters: {}
    }, { functionName: 'qrcode-generate' });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      success: true,
      qrcode: 'data:image/png;base64,qrcode'
    });
    expect(QRCode.toDataURL).toHaveBeenCalledWith('LPA:1$example', expect.objectContaining({
      type: 'image/png',
      width: 300
    }));
  });

  it('缺少 data 时应该返回 400', async () => {
    const result = await qrcodeGenerate.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: JSON.stringify({ size: 300 }),
      queryStringParameters: {}
    }, { functionName: 'qrcode-generate' });

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('data is required');
  });

  it('size 超出范围时应该返回 400', async () => {
    const result = await qrcodeGenerate.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: JSON.stringify({ data: 'LPA:1$example', size: 601 }),
      queryStringParameters: {}
    }, { functionName: 'qrcode-generate' });

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('size must be between 200 and 600');
  });

  it('非 POST 请求应该返回 405', async () => {
    const result = await qrcodeGenerate.handler({
      httpMethod: 'GET',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: '{}',
      queryStringParameters: {}
    }, { functionName: 'qrcode-generate' });

    expect(result.statusCode).toBe(405);
  });

  it('size 为非整数时应该返回 400', async () => {
    const result = await qrcodeGenerate.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: JSON.stringify({ data: 'LPA:1$example', size: 300.5 }),
      queryStringParameters: {}
    }, { functionName: 'qrcode-generate' });

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('size must be an integer');
  });

  it('size 低于最小值时应该返回 400', async () => {
    const result = await qrcodeGenerate.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: JSON.stringify({ data: 'LPA:1$example', size: 199 }),
      queryStringParameters: {}
    }, { functionName: 'qrcode-generate' });

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('size must be between 200 and 600');
  });

  it('data 为非字符串时应该被拒绝', async () => {
    const result = await qrcodeGenerate.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: JSON.stringify({ data: 12345, size: 300 }),
      queryStringParameters: {}
    }, { functionName: 'qrcode-generate' });

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('data must be of type string');
  });

  it('QRCode 生成失败时应该返回 500', async () => {
    // Mock QRCode.toDataURL 抛出错误
    QRCode.toDataURL.mockRejectedValueOnce(new Error('QR generation failed'));

    const result = await qrcodeGenerate.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: JSON.stringify({ data: 'LPA:1$example', size: 300 }),
      queryStringParameters: {}
    }, { functionName: 'qrcode-generate' });

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('error');
  });
});
