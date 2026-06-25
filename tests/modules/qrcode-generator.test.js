/**
 * qrcode-generator 模块单元测试
 */

// 使用共享状态对象控制 mock 行为，避免 jest.resetModules() 导致引用失效
const mockState = { lib: jest.fn() };

jest.mock('../../src/js/modules/qrcode-lib.js', () => ({
  __esModule: true,
  default: (...args) => mockState.lib(...args)
}));

describe('qrcode-generator', () => {
  /** 创建本地生成失败的 qrcode-generator mock */
  function createFailingQRMock() {
    return jest.fn(() => ({
      addData: jest.fn(),
      make: jest.fn(() => { throw new Error('local failed'); }),
      getModuleCount: jest.fn(() => 25),
      createDataURL: jest.fn()
    }));
  }

  /** 创建正常工作的 qrcode-generator mock */
  function createWorkingQRMock() {
    return jest.fn(() => ({
      addData: jest.fn(),
      make: jest.fn(),
      getModuleCount: jest.fn(() => 25),
      createDataURL: jest.fn((cellSize, margin) => `data:image/png;base64,local-${cellSize}`)
    }));
  }

  beforeEach(() => {
    jest.resetModules();
    fetch.mockReset();
    mockState.lib = jest.fn();
  });

  it('应该使用本地打包 qrcode-lib 生成 img 容器', async () => {
    const mockQRInstance = {
      addData: jest.fn(),
      make: jest.fn(),
      getModuleCount: jest.fn(() => 25),
      createDataURL: jest.fn((cellSize, margin) => `data:image/png;base64,local-${cellSize}`)
    };
    mockState.lib = jest.fn(() => mockQRInstance);

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');
    const result = await generateQRCodeLocal('LPA:1$example', 300);

    expect(result.source).toBe('local');
    expect(result.container.className).toBe('qrcode-container');
    expect(result.container.querySelector('img').getAttribute('src')).toContain('data:image/png;base64,local-');
    expect(mockState.lib).toHaveBeenCalledWith(0, 'M');
    expect(mockQRInstance.addData).toHaveBeenCalledWith('LPA:1$example');
    expect(mockQRInstance.make).toHaveBeenCalled();
    expect(mockQRInstance.createDataURL).toHaveBeenCalledTimes(2);
  });

  it('本地生成失败时应该调用后端 BFF 降级', async () => {
    mockState.lib = createFailingQRMock();

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
    mockState.lib = createFailingQRMock();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const { generateQRCodeWithFallback } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeWithFallback('LPA:1$example', 300))
      .rejects.toThrow('QR code generation failed after local and backend fallback');
  });

  it('应该拒绝过长的二维码内容', async () => {
    mockState.lib = jest.fn();

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('x'.repeat(2049), 300))
      .rejects.toThrow('QR code data length must be between');
  });

  it('应该拒绝非整数的 size', async () => {
    mockState.lib = jest.fn();

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('LPA:1$example', 300.5))
      .rejects.toThrow('QR code size must be an integer');
  });

  it('应该拒绝低于最小值的 size', async () => {
    mockState.lib = jest.fn();

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('LPA:1$example', 199))
      .rejects.toThrow('QR code size must be between 200 and 600');
  });

  it('应该拒绝高于最大值的 size', async () => {
    mockState.lib = jest.fn();

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('LPA:1$example', 601))
      .rejects.toThrow('QR code size must be between 200 and 600');
  });

  it('应该拒绝非字符串的 data', async () => {
    mockState.lib = jest.fn();

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal(12345, 300))
      .rejects.toThrow('QR code data must be a string');
  });

  it('后端超时时应该抛出超时错误', async () => {
    mockState.lib = createFailingQRMock();

    fetch.mockImplementationOnce(() =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        }, 10);
      })
    );

    const { generateQRCodeBackend } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeBackend('LPA:1$example', 300))
      .rejects.toThrow('Backend QR code generation timed out after 10000ms');
  });

  it('后端返回无效 JSON 时应该抛出错误', async () => {
    mockState.lib = createFailingQRMock();

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: false })
    });

    const { generateQRCodeWithFallback } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeWithFallback('LPA:1$example', 300))
      .rejects.toThrow('QR code generation failed after local and backend fallback');
  });

  // ========== 日志和 Sentry 上报测试 ==========

  it('本地生成成功时应输出 console.log', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const mockQRInstance = {
      addData: jest.fn(),
      make: jest.fn(),
      getModuleCount: jest.fn(() => 25),
      createDataURL: jest.fn((cellSize, margin) => `data:image/png;base64,local-${cellSize}`)
    };
    mockState.lib = jest.fn(() => mockQRInstance);

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');
    await generateQRCodeLocal('LPA:1$example', 300);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[QRCode] Local generation success')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('size=300')
    );
    consoleSpy.mockRestore();
  });

  it('本地生成失败时应输出 console.warn 并上报 Sentry', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    window.Sentry = { captureMessage: jest.fn() };

    mockState.lib = createFailingQRMock();

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, qrcode: 'data:image/png;base64,backend' })
    });

    const { generateQRCodeWithFallback } = await import('../../src/js/modules/qrcode-generator.js');
    await generateQRCodeWithFallback('LPA:1$example', 300);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[QRCode] Local generation failed'),
      expect.anything()
    );

    expect(window.Sentry.captureMessage).toHaveBeenCalledWith(
      'QR Code qr_fallback failed',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({
          module: 'qrcode-generation',
          source: 'local',
          type: 'qr_fallback'
        })
      })
    );

    delete window.Sentry;
    consoleSpy.mockRestore();
  });

  it('后端生成成功时应输出 console.log', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    mockState.lib = createFailingQRMock();

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, qrcode: 'data:image/png;base64,backend-qr-data' })
    });

    const { generateQRCodeWithFallback } = await import('../../src/js/modules/qrcode-generator.js');
    await generateQRCodeWithFallback('LPA:1$example', 300);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[QRCode] Backend generation success')
    );
    consoleSpy.mockRestore();
  });

  it('后端生成失败时应输出 console.error 并上报 Sentry', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    window.Sentry = { captureMessage: jest.fn() };

    mockState.lib = createFailingQRMock();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const { generateQRCodeWithFallback } = await import('../../src/js/modules/qrcode-generator.js');
    await expect(generateQRCodeWithFallback('LPA:1$example', 300))
      .rejects.toThrow('QR code generation failed after local and backend fallback');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[QRCode] Backend fallback failed'),
      expect.anything()
    );

    expect(window.Sentry.captureMessage).toHaveBeenCalledWith(
      'QR Code qr_generation failed',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({
          source: 'failed'
        })
      })
    );

    delete window.Sentry;
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('库不可用时本地生成应抛出错误', async () => {
    // mockState.lib 不是可调用函数时，generateQRCodeLocal 应捕获并包装错误
    mockState.lib = 'not-a-function';

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('LPA:1$example', 300))
      .rejects.toThrow('Local QR code generation failed');
  });

  it('库 throw 字符串时应正确捕获并包装', async () => {
    // qrcode-generator 库在某些异常路径下会 throw 字符串而非 Error 对象
    mockState.lib = jest.fn(() => ({
      addData: jest.fn(),
      make: jest.fn(() => { throw 'code length overflow'; }),
      getModuleCount: jest.fn(),
      createDataURL: jest.fn()
    }));

    const { generateQRCodeLocal } = await import('../../src/js/modules/qrcode-generator.js');

    await expect(generateQRCodeLocal('LPA:1$example', 300))
      .rejects.toThrow('Local QR code generation failed: code length overflow');
  });
});
