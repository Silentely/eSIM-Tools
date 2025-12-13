#!/usr/bin/env node
/**
 * Sentry 配置注入脚本
 *
 * 在构建时将 Sentry 环境变量注入到 sentry-config.js 文件中
 * 用法：在 npm run build 中调用此脚本
 */

const fs = require('fs');
const path = require('path');

const SENTRY_DSN = process.env.SENTRY_DSN || '';
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || 'production';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE ||
  (process.env.COMMIT_REF ? `esim-tools@${process.env.COMMIT_REF.slice(0, 7)}` : 'esim-tools@unknown');

// 要处理的配置文件（改为处理独立的 JS 配置文件，而非 HTML 内联脚本）
const configFile = 'dist/src/js/sentry-config.js';

console.log('[Sentry Config] 开始注入配置...');
console.log(`  DSN: ${SENTRY_DSN ? '已配置' : '未配置'}`);
console.log(`  Environment: ${SENTRY_ENVIRONMENT}`);
console.log(`  Release: ${SENTRY_RELEASE}`);

const fullPath = path.join(process.cwd(), configFile);

if (!fs.existsSync(fullPath)) {
  console.error(`  ✗ 错误: ${configFile} 不存在`);
  console.log('[Sentry Config] 失败，请确保构建流程正确复制了 sentry-config.js');
  process.exit(1);
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
console.log(`  ✓ 已处理: ${configFile}`);

console.log('[Sentry Config] 完成');
