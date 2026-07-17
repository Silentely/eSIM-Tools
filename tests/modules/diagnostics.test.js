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

  it('copyDiagnostics 应调用剪贴板', async () => {
    navigator.clipboard.writeText.mockResolvedValueOnce(undefined);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });

    const text = await copyDiagnostics({ app: 'home' });
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(text).toContain('```json');
  });

  it('installDiagnosticsGlobal 应挂载 copyEsimDiagnostics', async () => {
    navigator.clipboard.writeText.mockResolvedValueOnce(undefined);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });

    installDiagnosticsGlobal({
      app: 'simyo',
      getState: () => ({ sessionToken: 'abc', phoneNumber: '0611111111' })
    });

    expect(typeof window.copyEsimDiagnostics).toBe('function');
    const text = await window.copyEsimDiagnostics();
    expect(text).toContain('[redacted]');
    expect(text).toContain('0611111111');
  });
});
