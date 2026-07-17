#!/usr/bin/env node
/**
 * 生产静态资源脱链检查
 * 扫描 HTML 中的本地 script/link/href/src，确认文件在仓库或 dist 中存在。
 * 禁止把不存在的路径发布到生产。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const htmlRoots = [
  path.join(projectRoot, 'index.html'),
  path.join(projectRoot, 'src', 'giffgaff', 'giffgaff_modular.html'),
  path.join(projectRoot, 'src', 'simyo', 'simyo_modular.html'),
  // 若已构建，同步校验发布产物（与源入口路径对应）
  path.join(projectRoot, 'dist', 'index.html'),
  path.join(projectRoot, 'dist', 'src', 'giffgaff', 'giffgaff_modular.html'),
  path.join(projectRoot, 'dist', 'src', 'simyo', 'simyo_modular.html')
];

const ATTR_RE = /\b(?:src|href)=["']([^"']+)["']/gi;
const SKIP_PREFIXES = [
  'http://',
  'https://',
  '//',
  'data:',
  'mailto:',
  'tel:',
  'javascript:',
  '#',
  'blob:'
];

function shouldSkip(url) {
  return SKIP_PREFIXES.some((p) => url.startsWith(p));
}

// Netlify redirects 中的“软路由”（无静态文件，但生产可访问）
const KNOWN_ROUTES = new Set(['/giffgaff', '/simyo']);

function looksLikeStaticAsset(cleanPath) {
  // 有扩展名的视为静态资源；无扩展名多为路由入口
  const base = path.basename(cleanPath);
  return base.includes('.');
}

function resolveLocal(url) {
  // 去掉 query/hash
  const clean = url.split('?')[0].split('#')[0];
  if (!clean || clean.endsWith('/')) return null;
  if (KNOWN_ROUTES.has(clean)) return null;
  if (!looksLikeStaticAsset(clean)) return null;

  // 仅检查站点内绝对路径
  if (clean.startsWith('/')) {
    const fromRoot = path.join(projectRoot, clean.slice(1));
    const fromDist = path.join(projectRoot, 'dist', clean.slice(1));
    return { clean, candidates: [fromRoot, fromDist] };
  }

  return null;
}

function collectUrls(html) {
  const urls = new Set();
  let match;
  while ((match = ATTR_RE.exec(html)) !== null) {
    urls.add(match[1]);
  }
  return [...urls];
}

function main() {
  const missing = [];
  let checked = 0;

  for (const htmlPath of htmlRoots) {
    const relHtml = path.relative(projectRoot, htmlPath);
    const isDistEntry = relHtml.startsWith(`dist${path.sep}`) || relHtml.startsWith('dist/');

    // dist 入口仅在已构建时检查，避免未 build 时误报
    if (!fs.existsSync(htmlPath)) {
      if (!isDistEntry) {
        missing.push({ file: relHtml, url: '(file missing)', reason: 'HTML 入口不存在' });
      }
      continue;
    }

    const html = fs.readFileSync(htmlPath, 'utf8');
    const urls = collectUrls(html);

    for (const url of urls) {
      if (shouldSkip(url)) continue;
      const resolved = resolveLocal(url);
      if (!resolved) continue;

      checked++;
      // dist HTML 优先解析到 dist 下；源 HTML 源码与 dist 任一存在即可
      const candidates = isDistEntry
        ? [
            path.join(projectRoot, 'dist', resolved.clean.slice(1)),
            path.join(projectRoot, resolved.clean.slice(1))
          ]
        : resolved.candidates;
      const exists = candidates.some((p) => fs.existsSync(p));
      if (!exists) {
        missing.push({
          file: relHtml,
          url: resolved.clean,
          reason: isDistEntry
            ? '构建产物中资源不存在'
            : '本地文件不存在（源码与 dist 均未找到）'
        });
      }
    }
  }

  // 额外：构建产物中禁止残留 Webpack 路径提示（若 resource-hints 被挂载）
  const forbiddenHints = [
    '/dist/js/main.js',
    '/dist/js/vendors.js',
    '/dist/css/design-system.css'
  ];
  const resourceHintsPath = path.join(projectRoot, 'src', 'js', 'modules', 'resource-hints.js');
  if (fs.existsSync(resourceHintsPath)) {
    const content = fs.readFileSync(resourceHintsPath, 'utf8');
    for (const bad of forbiddenHints) {
      if (content.includes(bad)) {
        missing.push({
          file: 'src/js/modules/resource-hints.js',
          url: bad,
          reason: '遗留 Webpack 产物路径，生产构建不会生成该文件'
        });
      }
    }
  }

  console.log(`[check-asset-links] 已检查本地资源引用: ${checked}`);

  if (missing.length === 0) {
    console.log('[check-asset-links] ✅ 无脱链');
    process.exit(0);
  }

  console.error('[check-asset-links] ❌ 发现脱链/无效路径:');
  missing.forEach((m) => {
    console.error(`  - ${m.file}: ${m.url} (${m.reason})`);
  });
  process.exit(1);
}

main();
