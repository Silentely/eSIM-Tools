'use strict';

/**
 * 诊断信息导出测试
 */

import {
  collectDiagnostics,
  formatDiagnostics,
  copyDiagnostics,
  installDiagnosticsGlobal
} from '../../src/js/modules/diagnostics.js';

describe('diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.copyEsimDiagnostics;
    delete window.__esimDiagnostics;
  });

  it('collectDiagnostics 应脱敏敏感字段', () => {
    const snap = collectDiagnostics({
      app: 'simyo',
      state: {
        sessionToken: 'secret-token',
        phoneNumber: '0612345678',
        password: 'should-not-appear',
        currentStep: 2
      }
    });

    expect(snap.app).toBe('simyo');
    expect(snap.state.sessionToken).toBe('[redacted]');
    expect(snap.state.password).toBe('[redacted]');
    expect(snap.state.phoneNumber).toBe('0612345678');
    expect(snap.state.currentStep).toBe(2);
    expect(snap.page.hostname).toBeDefined();
  });

  it('formatDiagnostics 应输出可粘贴 markdown 代码块', () => {
    const text = formatDiagnostics({ app: 'giffgaff', state: { accessToken: 'tok' } });
    expect(text).toContain('```json');
    expect(text).toContain('[redacted]');
    expect(text).not.toContain('"accessToken": "tok"');
  });

  it('copyDiagnostics 成功时应标记 copied', async () => {
    navigator.clipboard.writeText.mockResolvedValueOnce(undefined);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });

    const result = await copyDiagnostics({ app: 'home' });
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(result.copied).toBe(true);
    expect(result.text).toContain('```json');
    expect(result.error).toBeNull();
  });

  it('copyDiagnostics 剪贴板失败时应返回 text 且不抛错', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });
    navigator.clipboard.writeText.mockRejectedValueOnce(
      new DOMException('Document is not focused.', 'NotAllowedError')
    );
    document.execCommand = jest.fn(() => false);

    const result = await copyDiagnostics({ app: 'home' });
    expect(result.copied).toBe(false);
    expect(result.text).toContain('```json');
    expect(result.error).toMatch(/Clipboard|focused|denied/i);
  });

  it('installDiagnosticsGlobal 在复制失败时不应 reject', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });
    navigator.clipboard.writeText.mockRejectedValueOnce(
      new DOMException('Document is not focused.', 'NotAllowedError')
    );
    document.execCommand = jest.fn(() => false);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    installDiagnosticsGlobal({
      app: 'simyo',
      getState: () => ({ sessionToken: 'abc', phoneNumber: '0611111111' })
    });

    expect(typeof window.copyEsimDiagnostics).toBe('function');
    const result = await window.copyEsimDiagnostics();
    expect(result.copied).toBe(false);
    expect(result.text).toContain('[redacted]');
    expect(result.text).toContain('0611111111');
    expect(warnSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('installDiagnosticsGlobal 成功路径应返回 copied=true', async () => {
    navigator.clipboard.writeText.mockResolvedValueOnce(undefined);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    installDiagnosticsGlobal({
      app: 'simyo',
      getState: () => ({ sessionToken: 'abc', phoneNumber: '0611111111' })
    });

    const result = await window.copyEsimDiagnostics();
    expect(result.copied).toBe(true);
    expect(result.text).toContain('[redacted]');
    logSpy.mockRestore();
  });
});
