const {
  versionHtmlScriptSources,
  versionJsImports
} = require('../../scripts/build-static.js');

describe('build versioning', () => {
  test('adds the build version to local script sources only', () => {
    const html = [
      '<script type="module" src="/src/js/init-home-stats.js"></script>',
      '<script defer src="/src/js/home.js"></script>',
      '<script src="https://cdn.example.com/lib.js"></script>',
      '<script type="module" src="/src/js/already.js?v=old"></script>'
    ].join('\n');

    const result = versionHtmlScriptSources(html, 'abc123');

    expect(result).toContain('src="/src/js/init-home-stats.js?v=abc123"');
    expect(result).toContain('src="/src/js/home.js?v=abc123"');
    expect(result).toContain('src="https://cdn.example.com/lib.js"');
    expect(result).toContain('src="/src/js/already.js?v=old"');
  });

  test('adds the build version to relative module imports', () => {
    const code = [
      'import { t } from "./modules/i18n.js";',
      'export { x } from "../shared/x.js";',
      'import "./side-effect.js";',
      'const lazy = () => import("./lazy.js");',
      'import Service from "/src/js/modules/notification-service.js";',
      'import { y } from "bare-package";'
    ].join('\n');

    const result = versionJsImports(code, 'abc123');

    expect(result).toContain('from "./modules/i18n.js?v=abc123"');
    expect(result).toContain('from "../shared/x.js?v=abc123"');
    expect(result).toContain('import "./side-effect.js?v=abc123"');
    expect(result).toContain('import("./lazy.js?v=abc123")');
    expect(result).toContain('from "/src/js/modules/notification-service.js?v=abc123"');
    expect(result).toContain('from "bare-package"');
  });

  test('does not append the version twice', () => {
    const code = 'import { t } from "./i18n.js?v=abc123";';
    expect(versionJsImports(code, 'abc123')).toBe(code);
  });
});
