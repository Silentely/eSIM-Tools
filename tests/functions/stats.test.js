const { handler, KEY_GIFFGAFF, KEY_SIMYO } = require('../../netlify/functions/stats');

describe('Stats Function (Netlify Serverless)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('CORS and Preflight', () => {
    test('handles OPTIONS request with 204 for allowed origin', async () => {
      const response = await handler({
        httpMethod: 'OPTIONS',
        headers: { origin: 'https://esim.cosr.eu.org' }
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['Access-Control-Allow-Methods']).toContain('GET, POST, OPTIONS');
    });

    test('rejects requests from disallowed origins with 403', async () => {
      const response = await handler({
        httpMethod: 'POST',
        headers: { origin: 'https://malicious-site.example.com' },
        body: JSON.stringify({ type: 'giffgaff' })
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Forbidden');
    });

    test('rejects unsupported methods with 405', async () => {
      const response = await handler({
        httpMethod: 'PUT',
        headers: {}
      });

      expect(response.statusCode).toBe(405);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Method Not Allowed');
    });
  });

  describe('GET /stats', () => {
    test('returns default zeros gracefully when Upstash is unconfigured', async () => {
      const response = await handler({
        httpMethod: 'GET',
        headers: {}
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toEqual({
        success: true,
        configured: false,
        giffgaff: 0,
        simyo: 0,
        total: 0
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('fetches and aggregates stats from Upstash Redis when configured', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: ['120', '80'] })
      });

      const response = await handler({
        httpMethod: 'GET',
        headers: {}
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toEqual({
        success: true,
        configured: true,
        giffgaff: 120,
        simyo: 80,
        total: 200
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://fake-redis.upstash.io',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-token'
          }),
          body: JSON.stringify(['MGET', KEY_GIFFGAFF, KEY_SIMYO])
        })
      );
    });

    test('gracefully handles Upstash failure without crashing', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

      global.fetch.mockRejectedValueOnce(new Error('Network connection timeout'));

      const response = await handler({
        httpMethod: 'GET',
        headers: {}
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(false);
      expect(data.total).toBe(0);
    });
  });

  describe('POST /stats (Increment & Input Validation)', () => {
    test('rejects invalid JSON syntax', async () => {
      const response = await handler({
        httpMethod: 'POST',
        body: 'invalid-json',
        headers: { 'client-ip': '1.2.3.1' }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Invalid JSON body');
    });

    test('rejects JSON null payload explicitly', async () => {
      const response = await handler({
        httpMethod: 'POST',
        body: 'null',
        headers: { 'client-ip': '1.2.3.2' }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Request body must be a JSON object');
    });

    test('rejects JSON array payload', async () => {
      const response = await handler({
        httpMethod: 'POST',
        body: '["giffgaff"]',
        headers: { 'client-ip': '1.2.3.3' }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Request body must be a JSON object');
    });

    test('rejects primitive JSON number/boolean/string payload', async () => {
      const response = await handler({
        httpMethod: 'POST',
        body: '"giffgaff"',
        headers: { 'client-ip': '1.2.3.4' }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Request body must be a JSON object');
    });

    test('rejects missing or invalid type parameter', async () => {
      const response = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({ type: 'unknown_carrier' }),
        headers: { 'client-ip': '1.2.3.5' }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('Invalid type parameter');
    });

    test('handles increment when Upstash is not configured without error', async () => {
      const response = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({ type: 'giffgaff' }),
        headers: { 'client-ip': '1.2.3.6' }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toEqual({
        success: true,
        configured: false,
        type: 'giffgaff',
        count: 0
      });
    });

    test('successfully increments giffgaff counter in Upstash', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 121 })
      });

      const response = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({ type: 'giffgaff' }),
        headers: { 'client-ip': '1.2.3.7' }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toEqual({
        success: true,
        configured: true,
        type: 'giffgaff',
        count: 121
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://fake-redis.upstash.io',
        expect.objectContaining({
          body: JSON.stringify(['INCR', KEY_GIFFGAFF])
        })
      );
    });

    test('triggers rate limiter on rapid consecutive POST requests', async () => {
      const ipHeaders = { 'client-ip': '192.168.10.99' };
      for (let i = 0; i < 5; i++) {
        await handler({
          httpMethod: 'POST',
          body: JSON.stringify({ type: 'giffgaff' }),
          headers: ipHeaders
        });
      }

      // 第 6 次应触发限流
      const rateLimitedResponse = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({ type: 'giffgaff' }),
        headers: ipHeaders
      });

      expect(rateLimitedResponse.statusCode).toBe(429);
      const data = JSON.parse(rateLimitedResponse.body);
      expect(data.error).toBe('Too Many Requests');
    });
  });
});
