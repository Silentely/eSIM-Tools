describe('BFF proxy guardrails', () => {
  const originalEnv = process.env;
  const OriginalRequest = global.Request;
  const OriginalResponse = global.Response;
  const OriginalDeno = global.Deno;
  const OriginalFetch = global.fetch;

  class MockHeaders {
    constructor(init = {}) {
      this.map = new Map();
      if (init && typeof init.entries === 'function') {
        Array.from(init.entries()).forEach(([key, value]) => {
          this.set(key, value);
        });
      } else {
        Object.entries(init).forEach(([key, value]) => {
          this.set(key, value);
        });
      }
    }

    get(name) {
      return this.map.get(String(name).toLowerCase()) || null;
    }

    set(name, value) {
      this.map.set(String(name).toLowerCase(), String(value));
    }

    delete(name) {
      this.map.delete(String(name).toLowerCase());
    }

    entries() {
      return this.map.entries();
    }

    [Symbol.iterator]() {
      return this.map[Symbol.iterator]();
    }
  }

  class MockRequest {
    constructor(url, init = {}) {
      this.url = url;
      this.method = init.method || 'GET';
      this.headers = init.headers instanceof MockHeaders ? init.headers : new MockHeaders(init.headers || {});
      this.body = init.body;
    }

    async arrayBuffer() {
      const text = typeof this.body === 'string' ? this.body : JSON.stringify(this.body || '');
      return new TextEncoder().encode(text).buffer;
    }

    async json() {
      const text = typeof this.body === 'string' ? this.body : JSON.stringify(this.body || '');
      return JSON.parse(text);
    }
  }

  class MockResponse {
    constructor(body = '', init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || '';
      this.headers = init.headers instanceof MockHeaders ? init.headers : new MockHeaders(init.headers || {});
    }

    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }
  }

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      ACCESS_KEY: 'test-access-key',
      ALLOWED_ORIGIN: 'https://esim.cosr.eu.org'
    };
    global.Deno = {
      env: {
        get: (name) => {
          if (name === 'ACCESS_KEY') return 'test-access-key';
          if (name === 'ALLOWED_ORIGIN') return 'https://esim.cosr.eu.org';
          return '';
        }
      }
    };
    global.Request = MockRequest;
    global.Response = MockResponse;
    global.fetch = jest.fn().mockResolvedValue(new MockResponse('ok', { status: 200, headers: { 'content-type': 'text/plain' } }));
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    global.Request = OriginalRequest;
    global.Response = OriginalResponse;
    global.fetch = OriginalFetch;
    global.Deno = OriginalDeno;
  });

  it('blocks unknown BFF targets', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/unknown-route', {
      method: 'POST',
      headers: { origin: 'https://esim.cosr.eu.org' }
    });

    const response = await mod.default(request);
    expect(response.status).toBe(404);
  });



  it('allows same-origin public GET requests without Origin', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/public-config', {
      method: 'GET'
    });

    const response = await mod.default(request);

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for missing-origin protected POST requests', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/verify-cookie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookie: 'test-cookie' })
    });

    const response = await mod.default(request);

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://esim.cosr.eu.org');
  });

  it('forwards allowlisted BFF targets with the server x-esim-key', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/giffgaff-token-exchange', {
      method: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'content-type': 'application/json',
        'x-esim-key': 'client-key',
        'x-app-key': 'client-app-key'
      },
      body: JSON.stringify({
        code: 'authorization-code',
        code_verifier: 'a'.repeat(64)
      })
    });

    const response = await mod.default(request);

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const proxiedRequest = global.fetch.mock.calls[0][0];
    expect(proxiedRequest.url).toBe('https://example.com/.netlify/functions/giffgaff-token-exchange');
    expect(proxiedRequest.headers.get('x-esim-key')).toBe('test-access-key');
    expect(proxiedRequest.headers.get('x-app-key')).toBeNull();
  });

  it('allows qrcode-generate BFF target (Edge 内联处理，无 proxy)', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/qrcode-generate', {
      method: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ data: 'LPA:1$example', size: 300 })
    });

    const response = await mod.default(request);

    expect(response.status).toBe(200);
    // Edge 内联处理，不应调用 fetch 代理到 Netlify Function
    expect(global.fetch).toHaveBeenCalledTimes(0);
    // 响应应包含 QR 码 data URL
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.qrcode).toMatch(/^data:image\/gif;base64,/);
  });

  it('qrcode-generate: 无效 JSON body 应返回 400', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/qrcode-generate', {
      method: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'content-type': 'application/json'
      },
      body: 'not-valid-json'
    });

    const response = await mod.default(request);
    expect(response.status).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Invalid JSON body');
  });

  it('qrcode-generate: 空 data 应返回 400', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/qrcode-generate', {
      method: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ data: '', size: 300 })
    });

    const response = await mod.default(request);
    expect(response.status).toBe(400);
  });

  it('qrcode-generate: 超长 data 应返回 400', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/qrcode-generate', {
      method: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ data: 'x'.repeat(2049), size: 300 })
    });

    const response = await mod.default(request);
    expect(response.status).toBe(400);
  });

  it('qrcode-generate: 非字符串 data 应返回 400', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/qrcode-generate', {
      method: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ data: 12345, size: 300 })
    });

    const response = await mod.default(request);
    expect(response.status).toBe(400);
  });

  it('qrcode-generate: size 超出范围应返回 400', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/qrcode-generate', {
      method: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ data: 'LPA:1$example', size: 601 })
    });

    const response = await mod.default(request);
    expect(response.status).toBe(400);
  });

  it('qrcode-generate: size 低于最小值应返回 400', async () => {
    const mod = await import('../../netlify/edge-functions/bff-proxy.js');
    const request = new Request('https://example.com/bff/qrcode-generate', {
      method: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ data: 'LPA:1$example', size: 199 })
    });

    const response = await mod.default(request);
    expect(response.status).toBe(400);
  });

});
