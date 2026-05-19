/**
 * Simyo 主流程编排测试（设备更换）
 */

describe('SimyoApp 设备更换主流程自动化', () => {
  let app;
  let mockShowStatus;
  let mockSkipDeviceChange;
  let mockApplyNewEsim;
  let mockVerifyCode;
  let mockIsMobileBrowser;
  let mockShowMobileWarning;
  let mockAuthLogin;

  beforeEach(async () => {
    jest.resetModules();

    document.body.innerHTML = `
      <button id="applyNewEsimBtn"></button>
      <div id="applyNewEsimStatus"></div>
      <button id="verifyCodeBtn" disabled></button>
      <div id="verifyCodeStatus"></div>
      <input id="validationCodeInput" />
      <input id="phoneNumber" />
      <input id="password" type="password" />
      <button id="loginBtn"></button>
      <div id="loginStatus"></div>
      <button id="getEsimBtn"></button>
      <div id="esimStatus"></div>
      <div id="esimInfo"></div>
      <button id="generateQrBtn"></button>
      <div id="qrStatus"></div>
      <button id="confirmInstallBtn"></button>
      <div id="confirmStatus"></div>
      <button id="clearSessionBtn"></button>
      <button id="helpBtn"></button>
      <div id="step1"></div>
      <div id="step2"></div>
      <div id="step3"></div>
      <div id="step4"></div>
      <div id="deviceChangeSteps"></div>
    `;

    mockShowStatus = jest.fn();
    mockSkipDeviceChange = jest.fn();
    mockApplyNewEsim = jest.fn();
    mockVerifyCode = jest.fn();

    jest.doMock('../../src/simyo/js/modules/ui-controller.js', () => ({
      uiController: {
        get elements() {
          return {
            loginBtn: document.getElementById('loginBtn'),
            loginStatus: document.getElementById('loginStatus'),
            getEsimBtn: document.getElementById('getEsimBtn'),
            esimStatus: document.getElementById('esimStatus'),
            esimInfo: document.getElementById('esimInfo'),
            generateQrBtn: document.getElementById('generateQrBtn'),
            qrStatus: document.getElementById('qrStatus'),
            confirmInstallBtn: document.getElementById('confirmInstallBtn'),
            confirmStatus: document.getElementById('confirmStatus'),
            clearSessionBtn: document.getElementById('clearSessionBtn')
          };
        },
        showStatus: (...args) => mockShowStatus(...args),
        updateStatusPanel: jest.fn(),
        showSection: jest.fn(),
        updateSteps: jest.fn(),
        showDeviceChangeSteps: jest.fn(),
        skipDeviceChange: (...args) => mockSkipDeviceChange(...args),
        showEsimInfo: jest.fn(),
        showQRResult: jest.fn(),
        resetUI: jest.fn()
      }
    }));

    jest.doMock('../../src/simyo/js/modules/device-change-handler.js', () => ({
      deviceChangeHandler: {
        applyNewEsim: (...args) => mockApplyNewEsim(...args),
        verifyCode: (...args) => mockVerifyCode(...args)
      }
    }));

    jest.doMock('../../src/simyo/js/modules/auth-handler.js', () => {
      mockAuthLogin = jest.fn();
      return {
        authHandler: {
          login: mockAuthLogin,
          isLoggedIn: jest.fn(() => true),
          getSessionToken: jest.fn(() => 'token')
        }
      };
    });

    jest.doMock('../../src/simyo/js/modules/esim-service.js', () => ({
      esimService: {
        getEsim: jest.fn(),
        generateLPAString: jest.fn(),
        confirmInstall: jest.fn()
      }
    }));

    jest.doMock('../../src/simyo/js/modules/state-manager.js', () => ({
      stateManager: {
        subscribe: jest.fn(),
        loadSession: jest.fn(() => false),
        getState: jest.fn(() => ({ currentStep: 1 })),
        get: jest.fn(() => 1),
        set: jest.fn(),
        setState: jest.fn(),
        clearSession: jest.fn()
      }
    }));

    jest.doMock('../../src/simyo/js/modules/utils.js', () => ({
      copyToClipboard: jest.fn(),
      showToast: jest.fn(),
      openHelp: jest.fn(),
      delay: jest.fn(() => Promise.resolve())
    }));

    jest.doMock('../../src/js/modules/browser-utils.js', () => {
      mockIsMobileBrowser = jest.fn(() => false);
      mockShowMobileWarning = jest.fn();
      return {
        isMobileBrowser: mockIsMobileBrowser,
        showMobileWarning: mockShowMobileWarning
      };
    });

    jest.doMock('../../src/js/modules/i18n.js', () => ({
      t: (key, params = {}) => {
        if (!params || Object.keys(params).length === 0) return key;
        return `${key}:${JSON.stringify(params)}`;
      },
      tl: (text) => text
    }));

    app = (await import('../../src/simyo/js/simyo-app.js')).default;
  });

  it('applyNewEsim 成功后应引导用户输入验证码', async () => {
    const codeInput = document.getElementById('validationCodeInput');
    const verifyBtn = document.getElementById('verifyCodeBtn');
    const focusSpy = jest.spyOn(codeInput, 'focus');

    codeInput.value = '123456';
    mockApplyNewEsim.mockResolvedValueOnce({
      success: true,
      message: 'apply-ok',
      nextStep: 'next-tip'
    });

    await app.handleApplyNewEsim();

    expect(mockApplyNewEsim).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(verifyBtn.disabled).toBe(false);
    expect(mockShowStatus).toHaveBeenCalledWith(
      document.getElementById('applyNewEsimStatus'),
      'apply-ok',
      'success'
    );
  });

  it('verifyCode 成功后应自动跳转到后续步骤', async () => {
    const codeInput = document.getElementById('validationCodeInput');
    codeInput.value = '123456';

    mockVerifyCode.mockResolvedValueOnce({
      success: true,
      message: 'verify-ok',
      nextStep: 'go-next'
    });

    await app.handleVerifyCode();

    expect(mockVerifyCode).toHaveBeenCalledWith('123456');
    expect(mockSkipDeviceChange).toHaveBeenCalledTimes(1);
  });

  it('手机浏览器登录时应弹出环境警告', async () => {
    mockIsMobileBrowser.mockReturnValue(true);
    document.getElementById('phoneNumber').value = '0612345678';
    document.getElementById('password').value = 'pass';
    mockAuthLogin.mockResolvedValue({ success: true, mode: 'standard' });

    await app.handleLogin();

    expect(mockShowMobileWarning).toHaveBeenCalledTimes(1);
  });

  it('手机浏览器设备更换时应弹出环境警告', async () => {
    mockIsMobileBrowser.mockReturnValue(true);
    mockApplyNewEsim.mockResolvedValueOnce({ success: true, message: 'ok' });

    await app.handleApplyNewEsim();

    expect(mockShowMobileWarning).toHaveBeenCalledTimes(1);
  });

  it('PC浏览器登录时不应弹出环境警告', async () => {
    mockIsMobileBrowser.mockReturnValue(false);
    document.getElementById('phoneNumber').value = '0612345678';
    document.getElementById('password').value = 'pass';
    mockAuthLogin.mockResolvedValue({ success: true, mode: 'standard' });

    await app.handleLogin();

    expect(mockShowMobileWarning).not.toHaveBeenCalled();
  });
});

