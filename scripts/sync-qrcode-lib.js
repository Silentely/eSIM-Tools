#!/usr/bin/env node
'use strict';

/**
 * 同步 qrcode-lib.js 浏览器版和 Edge Function Deno 版
 *
 * 两个文件共享相同的 minified 库代码，仅头部注释和导出方式不同。
 * 此脚本确保库代码部分完全一致，防止版本漂移。
 *
 * 用法: node scripts/sync-qrcode-lib.js
 */

const fs = require('fs');
const path = require('path');

const BROWSER_LIB = path.resolve(__dirname, '../src/js/modules/qrcode-lib.js');
const EDGE_LIB = path.resolve(__dirname, '../netlify/edge-functions/qrcode-lib.js');

function extractLibraryCode(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  // 提取 'use strict'; 和 export 之间的库代码
  const lines = content.split('\n');
  const libLines = lines.filter(line =>
    line !== "'use strict';" &&
    !line.startsWith('// ') &&
    !line.startsWith('/**') &&
    !line.startsWith(' * ') &&
    !line.startsWith(' */') &&
    line !== '' &&
    !line.startsWith('export ')
  );
  return libLines.join('\n');
}

const browserLib = extractLibraryCode(BROWSER_LIB);
const edgeLib = extractLibraryCode(EDGE_LIB);

if (browserLib === edgeLib) {
  console.log('✅ qrcode-lib.js 库代码已同步，无需更新');
  process.exit(0);
} else {
  console.error('❌ qrcode-lib.js 库代码不一致！');
  console.error('   浏览器版:', BROWSER_LIB);
  console.error('   Edge 版:', EDGE_LIB);
  console.error('   请确保两个文件的 minified 库代码完全相同');
  process.exit(1);
}
