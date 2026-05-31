describe('Functions authentication hardening', () => {
  const originalEnv = process.env;

  function loadModules(envOverrides = {}) {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      ACCESS_KEY: 'test-access-key',
      ALLOWED_ORIGIN: 'https://esim.cosr.eu.org',
      GIFFGAFF_CLIENT_ID: 'client-id',
      GIFFGAFF_CLIENT_SECRET: 'abcdefghijklmnopqrstuvwxyzABCDEF',
      GIFFGAFF_REDIRECT_URI: 'giffgaff://auth/callback/',
      ...envOverrides
    };

    return {
      axios: require('axios'),
      middleware: require('../../netlify/functions/_shared/middleware'),
      tokenExchange: require('../../netlify/functions/giffgaff-token-exchange')
    };
  }

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('rejects protected browserless calls without internal key', () => {
    const { middleware } = loadModules();

    expect(() => middleware.authenticate({
      httpMethod: 'POST',
      headers: {},
      body: '{}',
      queryStringParameters: {}
    })).toThrow('Origin not allowed');
  });

  it('allows protected browserless internal calls with x-esim-key', () => {
    const { middleware } = loadModules();

    const result = middleware.authenticate({
      httpMethod: 'POST',
      headers: { 'x-esim-key': 'test-access-key' },
      body: '{}',
      queryStringParameters: {}
    });

    expect(result.authorized).toBe(true);
  });


  it('allows OPTIONS preflight for allowed origin', () => {
    const { middleware } = loadModules();

    const result = middleware.authenticate({
      httpMethod: 'OPTIONS',
      headers: { origin: 'https://esim.cosr.eu.org' },
      body: '{}',
      queryStringParameters: {}
    });

    expect(result.preflight).toBe(true);
    expect(result.origin).toBe('https://esim.cosr.eu.org');
  });

  it('rejects OPTIONS preflight for disallowed origin', () => {
    const { middleware } = loadModules();

    expect(() => middleware.authenticate({
      httpMethod: 'OPTIONS',
      headers: { origin: 'https://evil.example.com' },
      body: '{}',
      queryStringParameters: {}
    })).toThrow('Origin not allowed');
  });

  it('does not accept authKey from query or body', () => {
    const { middleware } = loadModules();
    const event = {
      httpMethod: 'POST',
      headers: { origin: 'https://esim.cosr.eu.org' },
      body: JSON.stringify({ authKey: 'test-access-key' }),
      queryStringParameters: { authKey: 'test-access-key' }
    };

    expect(() => middleware.authenticate(event)).toThrow('Unauthorized');
  });

  it('uses server redirect URI for token exchange even if client sends another value', async () => {
    const { axios, tokenExchange } = loadModules();
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { access_token: 'token' }
    });

    const result = await tokenExchange.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: JSON.stringify({
        code: 'authorization-code',
        code_verifier: 'a'.repeat(64),
        redirect_uri: 'https://attacker.example/callback'
      }),
      queryStringParameters: {}
    }, { functionName: 'giffgaff-token-exchange' });

    expect(result.statusCode).toBe(200);
    const form = axios.post.mock.calls[0][1];
    expect(form).toContain('redirect_uri=giffgaff%3A%2F%2Fauth%2Fcallback%2F');
    expect(form).not.toContain('attacker.example');
  });



  it('throws a configuration error when ACCESS_KEY is missing for token exchange', async () => {
    const { tokenExchange } = loadModules({ ACCESS_KEY: '' });

    const result = await tokenExchange.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org'
      },
      body: JSON.stringify({
        code: 'authorization-code',
        code_verifier: 'a'.repeat(64)
      }),
      queryStringParameters: {}
    }, { functionName: 'giffgaff-token-exchange' });

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('ACCESS_KEY');
  });

  it('uses configured GIFFGAFF_REDIRECT_URI for token exchange', async () => {
    const { axios, tokenExchange } = loadModules({
      GIFFGAFF_REDIRECT_URI: 'giffgaff://custom/callback/'
    });
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { access_token: 'token' }
    });

    const result = await tokenExchange.handler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://esim.cosr.eu.org',
        'x-esim-key': 'test-access-key'
      },
      body: JSON.stringify({
        code: 'authorization-code',
        code_verifier: 'a'.repeat(64)
      }),
      queryStringParameters: {}
    }, { functionName: 'giffgaff-token-exchange' });

    expect(result.statusCode).toBe(200);
    const form = axios.post.mock.calls[0][1];
    expect(form).toContain('redirect_uri=giffgaff%3A%2F%2Fcustom%2Fcallback%2F');
  });
});
