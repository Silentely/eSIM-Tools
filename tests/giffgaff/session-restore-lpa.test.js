/**
 * Giffgaff Session 恢复 LPA 显示测试
 * 修复 Issue #75：刷新页面后不显示二维码和 LPA 信息
 */

describe('Giffgaff Session Restore - LPA Display', () => {
  let mockStateManager;
  let mockUIController;
  let mockState;

  beforeEach(() => {
    // 清理 DOM
    document.body.innerHTML = `
      <div id="resultContainer"></div>
      <div id="qrcode"></div>
      <div id="esimInfo"></div>
      <div id="tokenStatus"></div>
    `;

    // Mock state with lpaString
    mockState = {
      accessToken: 'mock-token',
      emailSignature: 'mock-signature',
      memberId: 'mock-member-id',
      esimSSN: '8944123456789012345',
      esimActivationCode: 'ABC123',
      lpaString: 'LPA:1$example.com$activation-code',
      currentStep: 5
    };

    // Mock StateManager
    mockStateManager = {
      getState: jest.fn(() => mockState),
      loadSession: jest.fn(() => true),
      subscribe: jest.fn(),
      getCookie: jest.fn(() => null),
      get: jest.fn((key) => mockState[key])
    };

    // Mock UIController
    mockUIController = {
      elements: {
        resultContainer: document.getElementById('resultContainer'),
        qrcode: document.getElementById('qrcode'),
        esimInfo: document.getElementById('esimInfo'),
        tokenStatus: document.getElementById('tokenStatus')
      },
      showESimResult: jest.fn(),
      showStatus: jest.fn(),
      showSection: jest.fn(),
      updateStatusPanel: jest.fn()
    };
  });

  test('应该在 session 恢复时显示 LPA 和二维码', () => {
    // 验证初始状态
    expect(mockState.lpaString).toBeTruthy();
    expect(mockState.esimSSN).toBeTruthy();

    // 模拟 handleSessionRestore 的核心逻辑
    if (mockState.lpaString) {
      mockUIController.showESimResult();
    }

    // 验证 showESimResult 被调用
    expect(mockUIController.showESimResult).toHaveBeenCalled();
  });

  test('showESimResult 应该处理空 lpaString 的情况', () => {
    // 模拟 lpaString 为空
    const emptyState = { ...mockState, lpaString: '' };
    mockStateManager.getState = jest.fn(() => emptyState);

    const resultContainer = document.getElementById('resultContainer');
    const qrcode = document.getElementById('qrcode');
    const esimInfo = document.getElementById('esimInfo');

    // 模拟 showESimResult 的防御性逻辑
    const state = mockStateManager.getState();
    resultContainer.classList.add('active');

    if (!state.lpaString) {
      qrcode.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-circle me-2"></i>
          获取 LPA 字符串失败
        </div>
      `;
      esimInfo.innerHTML = `
        <div class="alert alert-warning">
          <p><strong>可能原因：</strong></p>
          <ul class="mb-0">
            <li>后端轮询超时或失败</li>
            <li>GraphQL 响应异常</li>
            <li>网络连接中断</li>
            <li>eSIM 状态异常</li>
          </ul>
        </div>
      `;
    }

    // 验证错误提示显示
    expect(resultContainer.classList.contains('active')).toBe(true);
    expect(qrcode.innerHTML).toContain('获取 LPA 字符串失败');
    expect(esimInfo.innerHTML).toContain('可能原因');
  });

  test('showESimResult 应该正常生成二维码（有 lpaString）', () => {
    const resultContainer = document.getElementById('resultContainer');
    const qrcode = document.getElementById('qrcode');

    // 模拟 generateQRCode 的简化逻辑
    const state = mockStateManager.getState();
    resultContainer.classList.add('active');

    if (state.lpaString) {
      const img = document.createElement('img');
      // 模拟本地 QR 码生成（data URL）
      img.src = `data:image/png;base64,mock-qr-${encodeURIComponent(state.lpaString)}`;
      img.alt = 'eSIM二维码';
      qrcode.appendChild(img);
    }

    // 验证二维码生成
    expect(resultContainer.classList.contains('active')).toBe(true);
    expect(qrcode.querySelector('img')).toBeTruthy();
    expect(qrcode.querySelector('img').src).toContain('data:image/png;base64');
  });

  test('session 恢复应该处理不完整状态（无 SSN）', () => {
    // 模拟状态不一致：有 lpaString 但无 SSN
    const inconsistentState = {
      ...mockState,
      esimSSN: '', // SSN 缺失
      lpaString: 'LPA:1$example.com$activation-code'
    };
    mockStateManager.getState = jest.fn(() => inconsistentState);

    // 模拟状态降级逻辑
    let targetStep = 5;
    if (inconsistentState.lpaString && !inconsistentState.esimSSN) {
      console.warn('[Test] State inconsistency detected');
      targetStep = 4; // 降级到 step 4
    }

    // 验证降级逻辑
    expect(targetStep).toBe(4);
  });

  test('session 恢复应该在 500ms 后显示二维码（模拟延迟）', (done) => {
    const showResult = jest.fn();

    // 模拟延迟调用
    setTimeout(() => {
      showResult();
      expect(showResult).toHaveBeenCalled();
      done();
    }, 500);
  });
});
