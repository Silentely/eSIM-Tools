/**
 * SIM 状态异常提示与 GraphQL 错误详细透传测试
 */

// 模拟 secure-storage
jest.mock('../../src/js/modules/secure-storage.js', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn()
  }
}));

import { stateManager } from '../../src/giffgaff/js/modules/state-manager.js';
import { esimService } from '../../src/giffgaff/js/modules/esim-service.js';
import { uiController } from '../../src/giffgaff/js/modules/ui-controller.js';
import { TRANSLATIONS } from '../../src/js/modules/i18n-data.js';
import { AuthError, handleError } from '../../netlify/functions/_shared/middleware.js';
import { isActiveSim, normalizeSimStatus } from '../../src/giffgaff/js/modules/utils.js';

describe('SIM 状态与 GraphQL 错误处理增强测试', () => {
  beforeEach(() => {
    stateManager.clearSession();
    global.fetch = jest.fn();
    document.body.innerHTML = `
      <div id="memberInfo"></div>
      <div id="smsInlineStatus"></div>
      <div id="smsInlineSendBtn"></div>
      <div id="smsCodeInputSection" style="display:none"></div>
    `;
    uiController.elements.memberInfo = document.getElementById('memberInfo');
  });

  describe('中间件 AuthError 与 details 透传', () => {
    test('AuthError 正确携带 details 属性', () => {
      const err = new AuthError('上游错误', 422, { code: 'SIM_INACTIVE', raw: 'Bad Request' });
      expect(err.message).toBe('上游错误');
      expect(err.statusCode).toBe(422);
      expect(err.details).toEqual({ code: 'SIM_INACTIVE', raw: 'Bad Request' });
    });

    test('handleError 将 details 序列化输出给客户端', () => {
      const err = new AuthError('业务校验错误', 422, { reason: 'card_expired' });
      const response = handleError(err, 'test-ctx');
      expect(response.statusCode).toBe(422);
      const parsed = JSON.parse(response.body);
      expect(parsed.message).toBe('业务校验错误');
      expect(parsed.details).toEqual({ reason: 'card_expired' });
    });
  });

  describe('stateManager 与 esimService 的 simStatus 追踪', () => {
    test('getMemberInfo 成功时保存 simStatus 到 stateManager', async () => {
      stateManager.setState({ accessToken: 'test-token', emailSignature: 'test-sig' });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            memberProfile: { id: 'm123', memberName: 'testuser' },
            sim: { phoneNumber: '07123456789', status: 'INACTIVE' }
          }
        })
      });

      const res = await esimService.getMemberInfo();
      expect(res.success).toBe(true);
      expect(stateManager.getState().simStatus).toBe('INACTIVE');
      expect(stateManager.getState().phoneNumber).toBe('07123456789');
    });

    test('stateManager 保存和恢复包含 simStatus', () => {
      stateManager.setState({ simStatus: 'SUSPENDED', phoneNumber: '07999999999' });
      expect(stateManager.getState().simStatus).toBe('SUSPENDED');
      stateManager.clearSession();
      expect(stateManager.getState().simStatus).toBe('');
    });

    test('_friendlyGraphqlError 对 422 Bad Request 与卡状态异常生成友好提示', () => {
      const friendly1 = esimService._friendlyGraphqlError(422, { message: 'Upstream GraphQL 业务校验错误: Bad Request (SIM卡状态可能异常、已停机或不满足换卡条件)' });
      expect(friendly1.includes('SIM卡异常停机') || friendly1.includes('SIM deactivated')).toBe(true);

      const friendly2 = esimService._friendlyGraphqlError(422, { message: 'Bad Request' });
      expect(friendly2.includes('SIM卡异常停机') || friendly2.includes('SIM deactivated')).toBe(true);
    });
  });

  describe('UI 层对异常 SIM 状态的警告提示', () => {
    test('sim.status 非 ACTIVE 时显示醒目的警告卡片和排查指引', () => {
      stateManager.setState({ memberId: '123', memberName: 'Alice', phoneNumber: '07111222333', simStatus: 'INACTIVE' });
      uiController.showMemberInfo({
        sim: { status: 'INACTIVE' }
      });

      const container = document.getElementById('memberInfo');
      // 测试环境在 en 默认语言下应输出对应的 warning 内容
      expect(container.innerHTML.includes('SIM 卡状态异常警告') || container.innerHTML.includes('SIM status abnormal warning')).toBe(true);
      expect(container.innerHTML).toContain('INACTIVE');
      expect(container.innerHTML.includes('长期未消费停机') || container.innerHTML.includes('Deactivated due to inactivity')).toBe(true);
      expect(container.innerHTML.includes('新卡未满 24 小时') || container.innerHTML.includes('Newly activated')).toBe(true);
    });

    test('sim.status 为 ACTIVE 时正常展示不显示异常警告', () => {
      stateManager.setState({ memberId: '123', memberName: 'Bob', phoneNumber: '07111222333', simStatus: 'ACTIVE' });
      uiController.showMemberInfo({
        sim: { status: 'ACTIVE' }
      });

      const container = document.getElementById('memberInfo');
      expect(container.innerHTML).not.toContain('SIM 卡状态异常警告');
      expect(container.innerHTML).not.toContain('SIM status abnormal warning');
      expect(container.innerHTML).toContain('bg-success');
    });
    test('sim.status 为 STATUS_ACTIVE 时正常展示不显示异常警告', () => {
      stateManager.setState({ memberId: '123', memberName: 'Charlie', phoneNumber: '07111222333', simStatus: 'STATUS_ACTIVE' });
      uiController.showMemberInfo({
        sim: { status: 'STATUS_ACTIVE' }
      });

      const container = document.getElementById('memberInfo');
      expect(container.innerHTML).not.toContain('SIM 卡状态异常警告');
      expect(container.innerHTML).not.toContain('SIM status abnormal warning');
      expect(container.innerHTML).toContain('bg-success');
    });

    test('sim.status 为 STATUS_INACTIVE 时显示醒目的警告卡片', () => {
      stateManager.setState({ memberId: '123', memberName: 'Dave', phoneNumber: '07111222333', simStatus: 'STATUS_INACTIVE' });
      uiController.showMemberInfo({
        sim: { status: 'STATUS_INACTIVE' }
      });

      const container = document.getElementById('memberInfo');
      expect(container.innerHTML.includes('SIM 卡状态异常警告') || container.innerHTML.includes('SIM status abnormal warning')).toBe(true);
      expect(container.innerHTML).toContain('STATUS_INACTIVE');
    });
  });


  describe('isActiveSim 与 normalizeSimStatus 状态判定健壮性', () => {
    test('正确识别 ACTIVE 与 STATUS_ACTIVE 为活跃卡', () => {
      expect(isActiveSim('ACTIVE')).toBe(true);
      expect(isActiveSim('STATUS_ACTIVE')).toBe(true);
      expect(isActiveSim(' active ')).toBe(true);
      expect(isActiveSim('status_active')).toBe(true);
      expect(isActiveSim('ACTIVE_SIM')).toBe(true);
    });

    test('正确拦截非活跃状态', () => {
      expect(isActiveSim('INACTIVE')).toBe(false);
      expect(isActiveSim('STATUS_INACTIVE')).toBe(false);
      expect(isActiveSim('SUSPENDED')).toBe(false);
      expect(isActiveSim('STATUS_SUSPENDED')).toBe(false);
      expect(isActiveSim('PENDING')).toBe(false);
      expect(isActiveSim('BARRED')).toBe(false);
      expect(isActiveSim('')).toBe(false);
      expect(isActiveSim(null)).toBe(false);
      expect(isActiveSim(undefined)).toBe(false);
    });

    test('normalizeSimStatus 统一去除 STATUS_ 前缀并规范化', () => {
      expect(normalizeSimStatus('STATUS_ACTIVE')).toBe('ACTIVE');
      expect(normalizeSimStatus('STATUS_INACTIVE')).toBe('INACTIVE');
      expect(normalizeSimStatus('  active  ')).toBe('ACTIVE');
      expect(normalizeSimStatus('')).toBe('');
      expect(normalizeSimStatus(null)).toBe('');
    });
  });

  describe('国际化字典（i18n）包含新的错误与排查引导项', () => {
    test('zh 包含卡状态异常及详细短信错误文案', () => {
      expect(TRANSLATIONS['zh']['giffgaff.app.error.simStatusAbnormal']).toContain('SIM 卡状态异常');
      expect(TRANSLATIONS['zh']['giffgaff.app.error.simStatusAbnormalWithCheck']).toContain('长期未消费导致停机回收');
      expect(TRANSLATIONS['zh']['giffgaff.app.error.smsSendFailedDetailed']).toContain('SIM卡异常停机');
    });

    test('en 包含对应的英文翻译', () => {
      expect(TRANSLATIONS['en']['giffgaff.app.error.simStatusAbnormal']).toContain('SIM status is abnormal');
      expect(TRANSLATIONS['en']['giffgaff.app.error.simStatusAbnormalWithCheck']).toContain('Inactive/deactivated');
      expect(TRANSLATIONS['en']['giffgaff.app.error.smsSendFailedDetailed']).toContain('SIM deactivated');
    });
  });
});
