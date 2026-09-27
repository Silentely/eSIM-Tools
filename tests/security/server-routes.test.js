const http = require('http');

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
      SIMYO_CLIENT_TOKEN: 'test-simyo-token',
      GIFFGAFF_CLIENT_ID: 'test-client-id',
      GIFFGAFF_CLIENT_SECRET: 'test-client-secret'
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
      '/bff/public-config',
      '/bff/health',
      '/bff/notifications'
    ];

    expect([...routes].sort()).toEqual([...expectedRoutes].sort());
  });

  it('exposes Netlify function routes for health and notifications', () => {
    const app = require('../../server.js');
    const routes = app.locals.functionRoutes;

    expect(routes).toContain('/.netlify/functions/health');
    expect(routes).toContain('/.netlify/functions/notifications');
  });

  it('serves health and notifications endpoints with 200 OK', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;

      http.get(`http://localhost:${port}/.netlify/functions/notifications`, (res) => {
        expect(res.statusCode).toBe(200);
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            expect(json.success).toBe(true);
            expect(Array.isArray(json.data)).toBe(true);
          } catch (e) {
            server.close();
            return done(e);
          }

          http.get(`http://localhost:${port}/.netlify/functions/health`, (healthRes) => {
            try {
              expect(healthRes.statusCode).toBe(200);
              server.close(done);
            } catch (e) {
              server.close();
              done(e);
            }
          }).on('error', (err) => {
            server.close();
            done(err);
          });
        });
      }).on('error', (err) => {
        server.close();
        done(err);
      });
    });
  });

  it('serves local /bff/qrcode-generate with 200 OK and valid image data URL', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;
      const postData = JSON.stringify({
        data: 'LPA:1$smdp.example.com$TEST123456',
        size: 300
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/bff/qrcode-generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Origin': 'http://localhost:3000'
        }
      }, (res) => {
        expect(res.statusCode).toBe(200);
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            expect(json.success).toBe(true);
            expect(typeof json.qrcode).toBe('string');
            expect(json.qrcode.startsWith('data:image/gif;base64,')).toBe(true);
            server.close(done);
          } catch (e) {
            server.close();
            done(e);
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        done(err);
      });

      req.write(postData);
      req.end();
    });
  });

  it('rejects array or forbidden keys on /bff/qrcode-generate with 400 Bad Request', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, async () => {
      const port = server.address().port;
      const testCases = [
        JSON.stringify([{ data: 'test', size: 300 }]),
        JSON.stringify({ data: 'test', size: 300, constructor: 'polluted' }),
        JSON.stringify({ data: 'test', size: 300, prototype: 'polluted' }),
        '{"data":"test","size":300,"__proto__":"polluted"}'
      ];

      try {
        for (const postData of testCases) {
          await new Promise((resolve, reject) => {
            const req = http.request({
              hostname: 'localhost',
              port,
              path: '/bff/qrcode-generate',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Origin': 'http://localhost:3000'
              }
            }, (res) => {
              let raw = '';
              res.on('data', chunk => { raw += chunk; });
              res.on('end', () => {
                try {
                  expect(res.statusCode).toBe(400);
                  const json = JSON.parse(raw);
                  expect(json.error).toBe('Invalid JSON body');
                  resolve();
                } catch (e) {
                  reject(e);
                }
              });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
          });
        }
        server.close(done);
      } catch (err) {
        server.close();
        done(err);
      }
    });
  });

  it('rejects invalid parameters on /bff/qrcode-generate with 400 Bad Request', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;
      const postData = JSON.stringify({
        data: '',
        size: 100 // below minimum 200
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/bff/qrcode-generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Origin': 'http://localhost:3000'
        }
      }, (res) => {
        expect(res.statusCode).toBe(400);
        server.close(done);
      });

      req.on('error', (err) => {
        server.close();
        done(err);
      });

      req.write(postData);
      req.end();
    });
  });


  it('blocks protected BFF requests with missing origin (symmetrical to Edge BFF)', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;
      const postData = JSON.stringify({ cookie: 'test=123' });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/bff/verify-cookie',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
          // Intentionally omitting Origin header
        }
      }, (res) => {
        expect(res.statusCode).toBe(403);
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            expect(json.error).toBe('Forbidden');
            expect(json.message).toBe('Origin not allowed');
            server.close(done);
          } catch (e) {
            server.close();
            done(e);
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        done(err);
      });

      req.write(postData);
      req.end();
    });
  });

  it('parses POST JSON body and strips client keys while injecting internal key in wrapNetlifyFunction', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;
      const postData = JSON.stringify({
        cookie: 'memberId=12345; sessionToken=test'
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/bff/verify-cookie',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Origin': 'http://localhost:3000',
          'x-app-key': 'attacker-client-key',
          'x-esim-key': 'attacker-internal-key'
        }
      }, (res) => {
        // verify-cookie requires valid cookie format, but it will process the request
        // because authentication passed (internal ACCESS_KEY injected, attacker key stripped)
        expect([200, 400]).toContain(res.statusCode);
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            // Neither 401 nor 403 (Unauthorized / Forbidden) which would happen if key was missing
            expect(res.statusCode).not.toBe(401);
            expect(res.statusCode).not.toBe(403);
            server.close(done);
          } catch (e) {
            server.close();
            done(e);
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        done(err);
      });

      req.write(postData);
      req.end();
    });
  });

  it('returns 400 Bad Request on malformed JSON payload instead of 500', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;
      const invalidJson = '{"broken": ';

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/bff/verify-cookie',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(invalidJson),
          'Origin': 'http://localhost:3000'
        }
      }, (res) => {
        expect(res.statusCode).toBe(400);
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            expect(json.error).toBe('Bad Request');
            server.close(done);
          } catch (e) {
            server.close();
            done(e);
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        done(err);
      });

      req.write(invalidJson);
      req.end();
    });
  });

  it('omits Access-Control-Allow-Origin or returns 403 on untrusted external CORS origin', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;
      const postData = JSON.stringify({ cookie: 'test' });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/bff/verify-cookie',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Origin': 'https://evil-unauthorized-site.com'
        }
      }, (res) => {
        expect(res.statusCode).toBe(403);
        expect(res.headers['access-control-allow-origin']).not.toBe('https://evil-unauthorized-site.com');
        server.close(done);
      });

      req.on('error', (err) => {
        server.close();
        done(err);
      });

      req.write(postData);
      req.end();
    });
  });

  it('rejects path traversal attempts on /api/simyo with 400 Bad Request', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/simyo/%2e%2e/secret',
        method: 'GET'
      }, (res) => {
        res.resume();
        try {
          expect(res.statusCode).toBe(400);
          server.close(done);
        } catch (e) {
          server.close();
          done(e);
        }
      });

      req.on('error', (err) => {
        server.close();
        done(err);
      });

      req.end();
    });
  });

  it('rejects path traversal attempts on /api/giffgaff with 400 Bad Request', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/giffgaff/%2e%2e/secret',
        method: 'GET'
      }, (res) => {
        res.resume();
        try {
          expect(res.statusCode).toBe(400);
          server.close(done);
        } catch (e) {
          server.close();
          done(e);
        }
      });

      req.on('error', (err) => {
        server.close();
        done(err);
      });

      req.end();
    });
  });

  it('applies rate limit headers to static page routes and 404 fallback', (done) => {
    const app = require('../../server.js');
    const server = http.createServer(app);

    server.listen(0, () => {
      const port = server.address().port;

      http.get(`http://localhost:${port}/`, (res) => {
        res.resume();
        try {
          expect(res.statusCode).toBe(200);
          expect(res.headers['ratelimit-limit']).toBeDefined();
        } catch (e) {
          server.close();
          return done(e);
        }

        http.get(`http://localhost:${port}/non-existent-page-fallback`, (fallbackRes) => {
          fallbackRes.resume();
          try {
            expect(fallbackRes.statusCode).toBe(404);
            expect(fallbackRes.headers['ratelimit-limit']).toBeDefined();
            server.close(done);
          } catch (e) {
            server.close();
            done(e);
          }
        }).on('error', (err) => {
          server.close();
          done(err);
        });
      }).on('error', (err) => {
        server.close();
        done(err);
      });
    });
  });

});
