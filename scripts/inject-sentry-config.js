#!/usr/bin/env node
/**
 * Sentry 配置注入脚本
 *
 * 在构建时将 Sentry 环境变量注入到 HTML 文件中
 * 用法：在 npm run build 中调用此脚本
 */

const fs = require('fs');
const path = require('path');

const SENTRY_DSN = process.env.SENTRY_DSN || '';
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || 'production';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE ||
  (process.env.COMMIT_REF ? `esim-tools@${process.env.COMMIT_REF.slice(0, 7)}` : 'esim-tools@unknown');

// 要处理的 HTML 文件列表
const htmlFiles = [
  'dist/index.html',
  'dist/src/giffgaff/giffgaff_modular.html',
  'dist/src/giffgaff/giffgaff_complete_esim.html',
  'dist/src/simyo/simyo_modular.html',
];

console.log('[Sentry Config] 开始注入配置...');
console.log(`  DSN: ${SENTRY_DSN ? '已配置' : '未配置'}`);
console.log(`  Environment: ${SENTRY_ENVIRONMENT}`);
console.log(`  Release: ${SENTRY_RELEASE}`);

let processedCount = 0;

htmlFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`  跳过: ${filePath} (文件不存在)`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // 替换配置占位符
  content = content.replace(
    /window\.SENTRY_DSN\s*=\s*['"][^'"]*['"]/,
    `window.SENTRY_DSN = '${SENTRY_DSN}'`
  );
  content = content.replace(
    /window\.SENTRY_ENVIRONMENT\s*=\s*['"][^'"]*['"]/,
    `window.SENTRY_ENVIRONMENT = '${SENTRY_ENVIRONMENT}'`
  );
  content = content.replace(
    /window\.SENTRY_RELEASE\s*=\s*['"][^'"]*['"]/,
    `window.SENTRY_RELEASE = '${SENTRY_RELEASE}'`
  );

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`  ✓ 已处理: ${filePath}`);
  processedCount++;
});

console.log(`[Sentry Config] 完成，共处理 ${processedCount} 个文件`);
