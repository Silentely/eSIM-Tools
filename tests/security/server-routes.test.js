jest.mock('cheerio', () => ({
  load: () => ({})
}));

describe('Local server route coverage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      ACCESS_KEY: 'test-access-key',
      ALLOWED_ORIGIN: 'https://esim.cosr.eu.org',
      SIMYO_CLIENT_TOKEN: 'test-simyo-token'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('exposes the same BFF targets locally as the production allowlist', () => {
    const app = require('../../server.js');
    const routes = app.locals.bffRoutes;

    const expectedRoutes = [
      '/bff/giffgaff-token-exchange',
      '/bff/giffgaff-graphql',
      '/bff/giffgaff-mfa-challenge',
      '/bff/giffgaff-mfa-validation',
      '/bff/giffgaff-sms-activate',
      '/bff/auto-activate-esim',
      '/bff/qrcode-generate',
      '/bff/verify-cookie',
      '/bff/public-config'
    ];

    expect([...routes].sort()).toEqual([...expectedRoutes].sort());
  });
});
