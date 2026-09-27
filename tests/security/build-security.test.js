const fs = require('fs');
const path = require('path');
const os = require('os');
const { shouldExclude, verifyDistSecurity, EXCLUDE_FILE_PATTERNS } = require('../../scripts/build-static.js');

describe('Build Static Security Scanner', () => {
  describe('EXCLUDE_FILE_PATTERNS & shouldExclude', () => {
    it('excludes sensitive, backup, config, and dev files', () => {
      const excludedFiles = [
        'README.md',
        'MODULE_ARCHITECTURE.md',
        'simyo_proxy_server.js',
        'example.txt',
        'screenshot-preview.jpg',
        '.env',
        '.env.local',
        '.env.production',
        'server.key',
        'certificate.pem',
        'cert.crt',
        'backup.bak',
        'legacy.old',
        'debug.log',
        'database.sqlite',
        'app.db',
        'bundle.js.map'
      ];

      for (const file of excludedFiles) {
        expect(shouldExclude(file)).toBe(true);
      }
    });

    it('allows clean public web assets', () => {
      const allowedFiles = [
        'index.html',
        'main.js',
        'performance.js',
        'design-system.css',
        'logo.png',
        'favicon.ico',
        'manifest.webmanifest',
        'robots.txt'
      ];

      for (const file of allowedFiles) {
        expect(shouldExclude(file)).toBe(false);
      }
    });
  });

  describe('verifyDistSecurity', () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'build-sec-test-'));
    });

    afterEach(async () => {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    it('passes when directory contains only clean web files', async () => {
      await fs.promises.writeFile(path.join(tempDir, 'index.html'), '<html><body>Safe</body></html>');
      await fs.promises.writeFile(path.join(tempDir, 'app.js'), 'console.log("Safe script");');
      await fs.promises.writeFile(path.join(tempDir, 'style.css'), 'body { color: black; }');

      await expect(verifyDistSecurity(tempDir)).resolves.not.toThrow();
    });

    it('throws error when sensitive token pattern is detected in text files', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ apiKey: 'ghp_123456789012345678901234567890123456' })
      );

      await expect(verifyDistSecurity(tempDir)).rejects.toThrow(/构建产物安全检查失败/);
    });

    it('throws error when known prohibited literal token is detected', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'client.js'),
        'const token = "e77b7e2f43db41bb95b17a2a11581a38";'
      );

      await expect(verifyDistSecurity(tempDir)).rejects.toThrow(/构建产物安全检查失败/);
    });

    it('throws error when configured sensitive env var is detected', async () => {
      process.env.ACCESS_KEY = 'super_secret_production_key_123';
      try {
        await fs.promises.writeFile(
          path.join(tempDir, 'runtime.js'),
          'console.log("Key: super_secret_production_key_123");'
        );

        await expect(verifyDistSecurity(tempDir)).rejects.toThrow(/构建产物安全检查失败/);
      } finally {
        delete process.env.ACCESS_KEY;
      }
    });

    it('throws error when excluded file type is found in distribution', async () => {
      await fs.promises.writeFile(path.join(tempDir, '.env'), 'SECRET_KEY=12345');

      await expect(verifyDistSecurity(tempDir)).rejects.toThrow(/构建产物安全检查失败/);
    });
  });
});
