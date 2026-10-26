import fs from 'fs';
import path from 'path';

describe('Giffgaff page performance hints', () => {
  test('preloads the critical Font Awesome fonts used above the fold', () => {
    const html = fs.readFileSync(
      path.resolve(process.cwd(), 'src/giffgaff/giffgaff_modular.html'),
      'utf8'
    );

    expect(html).toContain(
      '<link rel="preload" href="/src/assets/fontawesome/fa-solid-900.woff2" as="font" type="font/woff2" crossorigin>'
    );
    expect(html).toContain(
      '<link rel="preload" href="/src/assets/fontawesome/fa-brands-400.woff2" as="font" type="font/woff2" crossorigin>'
    );
  });
});
