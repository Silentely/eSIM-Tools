'use strict';

/**
 * qrcode-generate Function 单元测试
 */

describe('qrcode-generate Function', () => {
  const originalEnv = process.env;

  function loadFunction(toDataURLImpl) {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      ACCESS_KEY: 'test-access-key',
      ALLOWED_ORIGIN: 'https://esim.cosr.eu.org'
    };

    jest.doMock('qrcode', () => ({
      toDataURL: jest.fn(toDataURLImpl)
    }), { virtual: true });

    return {
      QRCode: require('qrcode'),
      qrcodeGenerate: require('../../netlify/functions/qrcode-generate')
    };
  }

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('有效请求应该返回 base64 PNG data URL', async () => {
    const { QRCode, qrcodeGenerate } = loadFunction(() => Promise.resolve('data:image/png;base64,qrcode'));

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
    const { qrcodeGenerate } = loadFunction(() => Promise.resolve('data:image/png;base64,qrcode'));

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
    const { qrcodeGenerate } = loadFunction(() => Promise.resolve('data:image/png;base64,qrcode'));

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
    const { qrcodeGenerate } = loadFunction(() => Promise.resolve('data:image/png;base64,qrcode'));

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
});
