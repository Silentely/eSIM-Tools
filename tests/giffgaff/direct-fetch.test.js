/**
 * 直取 eSIM 功能单元测试
 * 覆盖 fetchExistingESims / directFetchFlow 的正常与异常路径
 */

// 模拟 secure-storage 模块（必须在 import 之前）
jest.mock('../../src/js/modules/secure-storage.js', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn()
  }
}));

// 模拟 i18n 模块
jest.mock('../../src/js/modules/i18n.js', () => ({
  __esModule: true,
  t: jest.fn((key, vars) => {
    const map = {
      'giffgaff.directFetch.errors.missingToken': '缺少访问令牌',
      'giffgaff.directFetch.errors.empty': '未发现可下载的 eSIM',
      'giffgaff.directFetch.errors.multipleNeedPick': '检测到多个可下载的 eSIM',
      'giffgaff.directFetch.errors.generic': '直取 eSIM 失败：' + (vars?.message || ''),
    };
    return map[key] || key;
  }),
  tl: jest.fn((key) => key)
}));

// 模拟 utils 模块
jest.mock('../../src/giffgaff/js/modules/utils.js', () => ({
  __esModule: true,
  isNetlifyEnvironment: jest.fn(() => false)
}));

import { stateManager } from '../../src/giffgaff/js/modules/state-manager.js';
import { esimService } from '../../src/giffgaff/js/modules/esim-service.js';

describe('ESimService - directFetchFlow', () => {
  beforeEach(() => {
    // 重置状态
    stateManager.setState({
      accessToken: '',
      emailSignature: '',
      memberId: '',
      esimSSN: '',
      esimActivationCode: '',
      esimDeliveryStatus: '',
      lpaString: '',
      directFetchMode: false
    });

    // 重置 fetch mock
    global.fetch = jest.fn();
  });

  describe('fetchExistingESims', () => {
    test('成功返回 eSIM 列表', async () => {
      stateManager.setState({ accessToken: 'valid-token' });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { eSims: [{ ssn: 'SSN-001', __typename: 'ESim' }] }
        })
      });

      const result = await esimService.fetchExistingESims();
      expect(result).toEqual([{ ssn: 'SSN-001', __typename: 'ESim' }]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('缺 accessToken 时抛出异常', async () => {
      stateManager.setState({ accessToken: '' });
      await expect(esimService.fetchExistingESims()).rejects.toThrow(/访问令牌/);
    });

    test('HTTP 错误时抛出异常', async () => {
      stateManager.setState({ accessToken: 'tok' });
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      await expect(esimService.fetchExistingESims()).rejects.toThrow(/500/);
    });

    test('GraphQL errors 时抛出对应 message', async () => {
      stateManager.setState({ accessToken: 'tok' });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: 'Unauthorized' }]
        })
      });

      await expect(esimService.fetchExistingESims()).rejects.toThrow('Unauthorized');
    });

    test('返回空列表时返回空数组', async () => {
      stateManager.setState({ accessToken: 'tok' });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { eSims: [] }
        })
      });

      const result = await esimService.fetchExistingESims();
      expect(result).toEqual([]);
    });
  });

  describe('directFetchFlow', () => {
    test('单 eSIM 时自动完成并写入状态', async () => {
      stateManager.setState({ accessToken: 'tok' });
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { eSims: [{ ssn: 'SSN-A', __typename: 'ESim' }] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { eSimDownloadToken: { lpaString: 'LPA:1$test', host: 'h', matchingId: 'm' } }
          })
        });

      const result = await esimService.directFetchFlow();

      expect(result.success).toBe(true);
      expect(result.ssn).toBe('SSN-A');
      expect(result.lpaString).toBe('LPA:1$test');
      expect(stateManager.get('esimSSN')).toBe('SSN-A');
      expect(stateManager.get('lpaString')).toBe('LPA:1$test');
      expect(stateManager.get('directFetchMode')).toBe(true);
      expect(stateManager.get('esimDeliveryStatus')).toBe('DOWNLOADABLE');
    });

    test('多 eSIM 未选定 preselectedSsn 时抛出 MULTIPLE_ESIMS', async () => {
      stateManager.setState({ accessToken: 'tok' });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { eSims: [{ ssn: 'A' }, { ssn: 'B' }] }
        })
      });

      await expect(esimService.directFetchFlow()).rejects.toMatchObject({
        code: 'MULTIPLE_ESIMS',
        candidates: ['A', 'B']
      });
    });

    test('多 eSIM 已选定 preselectedSsn 时直接使用该 ssn', async () => {
      stateManager.setState({ accessToken: 'tok' });
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { eSims: [{ ssn: 'A' }, { ssn: 'B' }] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { eSimDownloadToken: { lpaString: 'LPA:1$B-token', host: 'h', matchingId: 'm' } }
          })
        });

      const result = await esimService.directFetchFlow('B');

      expect(result.success).toBe(true);
      expect(result.ssn).toBe('B');
      expect(result.lpaString).toBe('LPA:1$B-token');
      expect(stateManager.get('esimSSN')).toBe('B');
    });

    test('空列表时抛出 EMPTY_LIST', async () => {
      stateManager.setState({ accessToken: 'tok' });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { eSims: [] }
        })
      });

      await expect(esimService.directFetchFlow()).rejects.toMatchObject({
        code: 'EMPTY_LIST'
      });
    });
  });
});
