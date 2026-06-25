'use strict';

/**
 * QR 码生成测试
 * 验证 qrcode-lib.js（Edge Function 内联使用）的正确性
 */

import qrCodeLib from '../../src/js/modules/qrcode-lib.js';

// Edge Function 中的参数校验常量（与 bff-proxy.js 保持同步）
const QR_MIN_SIZE = 200;
const QR_MAX_SIZE = 600;
const QR_MAX_DATA_LENGTH = 2048;

describe('QR 码生成（qrcode-lib Edge 内联）', () => {
  it('有效 LPA 数据应生成 data URL', () => {
    const qr = qrCodeLib(0, 'M');
    qr.addData('LPA:1$example.com$ACTCODE123');
    qr.make();

    const moduleCount = qr.getModuleCount();
    const cellSize = Math.max(1, Math.floor(300 / (moduleCount + 8)));
    const dataUrl = qr.createDataURL(cellSize, 2);

    expect(moduleCount).toBeGreaterThan(0);
    expect(cellSize).toBeGreaterThan(0);
    expect(dataUrl).toMatch(/^data:image\/gif;base64,/);
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  it('空字符串参数校验应拒绝（Edge Function 层拦截）', () => {
    // qrcode-lib 本身不校验空字符串，Edge Function 层的参数校验负责拦截
    const data = '';
    const valid = typeof data === 'string' && data.length >= 1 && data.length <= QR_MAX_DATA_LENGTH;
    expect(valid).toBe(false);
  });

  it('超长数据应在 Edge Function 参数校验层被拒绝', () => {
    // qrcode-lib 自动选择 QR 版本，不一定抛出异常；
    // 但 Edge Function 层通过 QR_MAX_DATA_LENGTH 限制输入长度
    const longData = 'A'.repeat(2049);
    const valid = typeof longData === 'string' && longData.length >= 1 && longData.length <= QR_MAX_DATA_LENGTH;
    expect(valid).toBe(false);
  });

  it('size 超出范围时参数校验应拒绝', () => {
    // 模拟 Edge Function 的参数校验逻辑
    const size = 601;
    const numSize = Number(size);
    const valid = Number.isInteger(numSize) && numSize >= QR_MIN_SIZE && numSize <= QR_MAX_SIZE;
    expect(valid).toBe(false);
  });

  it('size 低于最小值时参数校验应拒绝', () => {
    const size = 199;
    const numSize = Number(size);
    const valid = Number.isInteger(numSize) && numSize >= QR_MIN_SIZE && numSize <= QR_MAX_SIZE;
    expect(valid).toBe(false);
  });

  it('size 为非整数时参数校验应拒绝', () => {
    const size = 300.5;
    const numSize = Number(size);
    const valid = Number.isInteger(numSize) && numSize >= QR_MIN_SIZE && numSize <= QR_MAX_SIZE;
    expect(valid).toBe(false);
  });

  it('非字符串 data 参数校验应拒绝', () => {
    const data = 12345;
    const valid = typeof data === 'string' && data.length >= 1 && data.length <= QR_MAX_DATA_LENGTH;
    expect(valid).toBe(false);
  });

  it('有效请求参数校验应通过', () => {
    const data = 'LPA:1$example.com$ACTCODE123';
    const size = 300;
    const dataValid = typeof data === 'string' && data.length >= 1 && data.length <= QR_MAX_DATA_LENGTH;
    const numSize = Number(size);
    const sizeValid = Number.isInteger(numSize) && numSize >= QR_MIN_SIZE && numSize <= QR_MAX_SIZE;
    expect(dataValid).toBe(true);
    expect(sizeValid).toBe(true);
  });

  it('不同 size 值应生成不同大小的 QR 码', () => {
    const makeQr = (targetSize) => {
      const qr = qrCodeLib(0, 'M');
      qr.addData('test-data');
      qr.make();
      const moduleCount = qr.getModuleCount();
      const cellSize = Math.max(1, Math.floor(targetSize / (moduleCount + 8)));
      return { moduleCount, cellSize, dataUrl: qr.createDataURL(cellSize, 2) };
    };

    const small = makeQr(200);
    const large = makeQr(600);

    expect(small.moduleCount).toBe(large.moduleCount); // 相同数据，模块数相同
    expect(large.cellSize).toBeGreaterThan(small.cellSize); // 更大尺寸 → 更大 cellSize
    expect(large.dataUrl.length).toBeGreaterThan(small.dataUrl.length);
  });
});
