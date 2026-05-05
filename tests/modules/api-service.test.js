/**
 * APIService 模块单元测试
 * 覆盖 HTTP 请求、重试、缓存、去重等核心功能
 */

import APIService from '../../src/js/modules/api-service';

describe('APIService', () => {
  let service;

  beforeEach(() => {
    service = new APIService({ baseURL: 'https://api.test.com', timeout: 5000, retries: 2 });
    fetch.mockReset();
    jest.useRealTimers();
  });

  describe('构造函数', () => {
    it('应该使用默认配置', () => {
      const defaultService = new APIService();
      expect(defaultService.baseURL).toBe('');
      expect(defaultService.timeout).toBe(30000);
      expect(defaultService.retries).toBe(3);
    });

    it('应该使用自定义配置', () => {
      expect(service.baseURL).toBe('https://api.test.com');
      expect(service.timeout).toBe(5000);
      expect(service.retries).toBe(2);
    });
  });

  describe('GET 请求', () => {
    it('应该发送 GET 请求并返回 JSON', async () => {
      const mockData = { id: 1, name: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockData)
      });

      const result = await service.get('/users');
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.test.com/users',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('应该处理非 JSON 响应', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('hello')
      });

      const result = await service.get('/text');
      expect(result).toBe('hello');
    });
  });

  describe('POST 请求', () => {
    it('应该发送 POST 请求并携带 body', async () => {
      const body = { name: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true })
      });

      const result = await service.post('/create', body);
      expect(result).toEqual({ success: true });

      const callArgs = fetch.mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe(JSON.stringify(body));
    });
  });

  describe('PUT 请求', () => {
    it('应该发送 PUT 请求', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ updated: true })
      });

      await service.put('/update', { id: 1 });
      expect(fetch.mock.calls[0][1].method).toBe('PUT');
    });
  });

  describe('DELETE 请求', () => {
    it('应该发送 DELETE 请求', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ deleted: true })
      });

      await service.delete('/remove');
      expect(fetch.mock.calls[0][1].method).toBe('DELETE');
    });
  });

  describe('错误处理', () => {
    it('应该在 HTTP 错误时抛出异常', async () => {
      // mock fetch 返回 error response，但重试会多次调用
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(service.get('/missing')).rejects.toThrow();
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('缓存机制', () => {
    it('应该缓存 GET 请求结果', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ data: 1 })
      });

      await service.get('/cached');
      expect(fetch).toHaveBeenCalledTimes(1);

      const result = await service.get('/cached');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 1 });
    });

    it('应该清除所有缓存', async () => {
      fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ data: 1 })
      });

      await service.get('/test');
      service.clearCache();

      await service.get('/test');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('应该清除特定端点的缓存', async () => {
      fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ data: 1 })
      });

      await service.get('/users/1');
      await service.get('/users/2');
      service.clearCacheEntry('/users/1');

      await service.get('/users/1');
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('请求去重', () => {
    it('应该去重并发的相同请求', async () => {
      fetch.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ data: 1 })
        }), 100);
      }));

      const [r1, r2, r3] = await Promise.all([
        service.get('/dedup'),
        service.get('/dedup'),
        service.get('/dedup')
      ]);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(r1).toEqual({ data: 1 });
    });
  });

  describe('getCacheKey()', () => {
    it('应该生成正确的缓存键', () => {
      const key = service.getCacheKey('https://api.test.com/test', 'GET', null);
      expect(key).toBe('GET:https://api.test.com/test:');
    });

    it('应该包含 body 到缓存键', () => {
      const key = service.getCacheKey('https://api.test.com/test', 'POST', { a: 1 });
      expect(key).toContain(JSON.stringify({ a: 1 }));
    });
  });
});
