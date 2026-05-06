/**
 * Giffgaff 状态管理模块测试
 */

import AppState from '../../src/js/modules/giffgaff/state';

describe('Giffgaff AppState', () => {
  beforeEach(() => {
    // 重置状态
    AppState.reset();
    // secureStorage 使用 sessionStorage，测试环境需要清理
    sessionStorage.clear();
  });

  describe('reset()', () => {
    it('应该重置所有状态到初始值', () => {
      // 设置一些值
      AppState.accessToken = 'test-token';
      AppState.memberId = 'test-member';
      AppState.currentStep = 3;

      // 重置
      AppState.reset();

      // 验证
      expect(AppState.accessToken).toBeNull();
      expect(AppState.memberId).toBeNull();
      expect(AppState.currentStep).toBe(1);
    });
  });

  describe('saveSession()', () => {
    it('应该将状态保存到 sessionStorage (通过 secureStorage)', () => {
      // 设置状态
      AppState.accessToken = 'test-token';
      AppState.memberId = 'test-member';
      AppState.currentStep = 2;

      // 保存
      AppState.saveSession();

      // 验证：secureStorage 包装格式 {value, expires, timestamp}
      const raw = sessionStorage.getItem('giffgaff_session');
      expect(raw).not.toBeNull();
      const wrapper = JSON.parse(raw);
      expect(wrapper.value.accessToken).toBe('test-token');
      expect(wrapper.value.memberId).toBe('test-member');
      expect(wrapper.value.currentStep).toBe(2);
      expect(wrapper.timestamp).toBeDefined();
    });
  });

  describe('loadSession()', () => {
    it('应该从 sessionStorage 加载有效会话', () => {
      // 准备会话数据（使用 secureStorage 包装格式）
      const sessionData = {
        accessToken: 'saved-token',
        memberId: 'saved-member',
        currentStep: 3,
        timestamp: Date.now()
      };
      const wrapper = {
        value: sessionData,
        expires: Date.now() + 7200000,
        timestamp: Date.now()
      };
      sessionStorage.setItem('giffgaff_session', JSON.stringify(wrapper));

      // 加载
      const result = AppState.loadSession();

      // 验证
      expect(result).toBe(true);
      expect(AppState.accessToken).toBe('saved-token');
      expect(AppState.memberId).toBe('saved-member');
      expect(AppState.currentStep).toBe(3);
    });

    it('应该拒绝过期的会话', () => {
      // 准备过期会话（3小时前，已过期）
      const sessionData = {
        accessToken: 'old-token',
        timestamp: Date.now() - (3 * 60 * 60 * 1000)
      };
      const wrapper = {
        value: sessionData,
        expires: Date.now() - 1000,
        timestamp: Date.now() - (3 * 60 * 60 * 1000)
      };
      sessionStorage.setItem('giffgaff_session', JSON.stringify(wrapper));

      // 加载
      const result = AppState.loadSession();

      // 验证
      expect(result).toBe(false);
      expect(AppState.accessToken).toBeNull();
      expect(sessionStorage.getItem('giffgaff_session')).toBeNull();
    });
  });

  describe('getTargetStep()', () => {
    it('应该根据状态返回正确的步骤', () => {
      // 初始状态
      expect(AppState.getTargetStep()).toBe(1);

      // 有 accessToken
      AppState.accessToken = 'token';
      expect(AppState.getTargetStep()).toBe(2);

      // 有 emailSignature
      AppState.emailSignature = 'signature';
      expect(AppState.getTargetStep()).toBe(4);

      // 有 esimSSN
      AppState.esimSSN = 'ssn';
      expect(AppState.getTargetStep()).toBe(5);

      // 有 lpaString
      AppState.lpaString = 'lpa';
      expect(AppState.getTargetStep()).toBe(6);
    });
  });

  describe('clearSession()', () => {
    it('应该清除会话并重置状态', () => {
      // 设置会话
      AppState.accessToken = 'token';
      AppState.saveSession();

      // 清除
      AppState.clearSession();

      // 验证
      expect(sessionStorage.getItem('giffgaff_session')).toBeNull();
      expect(AppState.accessToken).toBeNull();
      expect(AppState.currentStep).toBe(1);
    });
  });
});
