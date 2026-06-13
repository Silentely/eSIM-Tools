/**
 * qrcode-generator 模块单元测试
 */

describe('qrcode-generator', () => {
  beforeEach(() => {
    jest.resetModules();
    fetch.mockReset();
    delete window.QRCode;
  });

  it('应该使用浏览器本地 qrcode.js 生成 img 容器', async () => {
    window.QRCode = {
      toDataURL: jest.fn((data, options) => Promise.resolve(`data:image/png;base64,local-${options.width}`))
    };

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');
    const result = await generateQRCodeLocal('LPA:1$example', 300);

    expect(result.source).toBe('local');
    expect(result.container.className).toBe('qrcode-container');
    expect(result.container.querySelector('img').getAttribute('src')).toBe('data:image/png;base64,local-300');
    expect(window.QRCode.toDataURL).toHaveBeenCalledTimes(2);
  });

  it('本地生成失败时应该调用后端 BFF 降级', async () => {
    window.QRCode = {
      toDataURL: jest.fn(() => Promise.reject(new Error('local failed')))
    };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, qrcode: 'data:image/png;base64,backend' })
    });

    const { generateQRCodeWithFallback } = await import('../../src/js/modules/qrcode-generator.js');
    const result = await generateQRCodeWithFallback('LPA:1$example', 300);

    expect(result.source).toBe('backend');
    expect(fetch).toHaveBeenCalledWith('/bff/qrcode-generate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ data: 'LPA:1$example', size: 300 })
    }));
  });

  it('本地和后端都失败时应该抛出最终错误', async () => {
    window.QRCode = {
      toDataURL: jest.fn(() => Promise.reject(new Error('local failed')))
    };
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const { generateQRCodeWithFallback } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeWithFallback('LPA:1$example', 300))
      .rejects.toThrow('QR code generation failed after local and backend fallback');
  });

  it('应该拒绝过长的二维码内容', async () => {
    window.QRCode = {
      toDataURL: jest.fn()
    };

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('x'.repeat(2049), 300))
      .rejects.toThrow('Local QR code generation failed');
  });

  it('应该拒绝非整数的 size', async () => {
    window.QRCode = {
      toDataURL: jest.fn()
    };

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('LPA:1$example', 300.5))
      .rejects.toThrow('QR code size must be an integer');
  });

  it('应该拒绝低于最小值的 size', async () => {
    window.QRCode = {
      toDataURL: jest.fn()
    };

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('LPA:1$example', 199))
      .rejects.toThrow('QR code size must be between 200 and 600');
  });

  it('应该拒绝高于最大值的 size', async () => {
    window.QRCode = {
      toDataURL: jest.fn()
    };

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('LPA:1$example', 601))
      .rejects.toThrow('QR code size must be between 200 and 600');
  });

  it('应该拒绝非字符串的 data', async () => {
    window.QRCode = {
      toDataURL: jest.fn()
    };

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal(12345, 300))
      .rejects.toThrow('QR code data must be a string');
  });

  it('后端超时时应该抛出超时错误', async () => {
    window.QRCode = {
      toDataURL: jest.fn(() => Promise.reject(new Error('local failed')))
    };

    // Mock fetch 超时（AbortError）
    fetch.mockImplementationOnce(() =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        }, 10);
      })
    );

    const { generateQRCodeWithFallback } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeWithFallback('LPA:1$example', 300))
      .rejects.toThrow('QR code generation failed after local and backend fallback');
  });

  it('后端返回无效 JSON 时应该抛出错误', async () => {
    window.QRCode = {
      toDataURL: jest.fn(() => Promise.reject(new Error('local failed')))
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: false })
    });

    const { generateQRCodeWithFallback } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeWithFallback('LPA:1$example', 300))
      .rejects.toThrow('QR code generation failed after local and backend fallback');
  });
});
