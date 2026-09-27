const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

describe('CSP Integrity and Hardening', () => {
  const htmlFiles = [
    path.resolve(__dirname, '../../index.html'),
    path.resolve(__dirname, '../../src/giffgaff/giffgaff_modular.html'),
    path.resolve(__dirname, '../../src/simyo/simyo_modular.html')
  ];

  const netlifyTomlPath = path.resolve(__dirname, '../../netlify.toml');

  it('eliminates unsafe-eval across all HTML meta tags and netlify.toml', () => {
    htmlFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const cspMatch = content.match(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content=["']([^"']+)["']/i);
      expect(cspMatch).not.toBeNull();
      const csp = cspMatch[1];
      expect(csp).not.toContain("'unsafe-eval'");
    });

    const netlifyToml = fs.readFileSync(netlifyTomlPath, 'utf8');
    const netlifyCspMatch = netlifyToml.match(/Content-Security-Policy\s*=\s*"([^"]+)"/);
    expect(netlifyCspMatch).not.toBeNull();
    expect(netlifyCspMatch[1]).not.toContain("'unsafe-eval'");
  });

  it('verifies that any inline executable scripts match their declared CSP hashes', () => {
    htmlFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const cspMatch = content.match(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content=["']([^"']+)["']/i);
      const csp = cspMatch ? cspMatch[1] : '';

      // Match inline script tags that are NOT non-executable JSON metadata (e.g. application/ld+json)
      const inlineScriptRegex = /<script(?![^>]*\bsrc\b)(?:(?!type=["'](?:application\/ld\+json)["'])[^>])*>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = inlineScriptRegex.exec(content)) !== null) {
        const scriptBody = match[1].trim();
        if (!scriptBody) continue;

        const hash = crypto.createHash('sha256').update(match[1]).digest('base64');
        const expectedToken = `'sha256-${hash}'`;

        expect(csp).toContain(expectedToken);
      }
    });
  });

  it('ensures simyo has zero unhashed inline scripts and loads runtime-fallback externally', () => {
    const simyoPath = path.resolve(__dirname, '../../src/simyo/simyo_modular.html');
    const simyoHtml = fs.readFileSync(simyoPath, 'utf8');

    expect(simyoHtml).toContain('src="/src/simyo/js/runtime-fallback.js"');
    const fallbackFile = path.resolve(__dirname, '../../src/simyo/js/runtime-fallback.js');
    expect(fs.existsSync(fallbackFile)).toBe(true);

    const fallbackCode = fs.readFileSync(fallbackFile, 'utf8');
    expect(fallbackCode).toContain('initSimyoRuntimeFallbacks');
  });

  it('aligns connect-src across Netlify and HTML meta tags', () => {
    const requiredConnectOrigins = [
      'https://qrcode.show',
      'https://api.qrserver.com'
    ];

    htmlFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const cspMatch = content.match(/connect-src\s+([^;]+)/i);
      expect(cspMatch).not.toBeNull();
      const connectSrc = cspMatch[1];

      requiredConnectOrigins.forEach((origin) => {
        expect(connectSrc).toContain(origin);
      });
    });
  });
});
