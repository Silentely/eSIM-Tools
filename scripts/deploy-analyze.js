#!/usr/bin/env node
const BuildLogger = require('./logger.js');

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function listFiles(dir, base = dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFiles(full, base));
    } else {
      const rel = path.relative(base, full);
      const size = fs.statSync(full).size;
      output.push({ rel, size });
    }
  }
  return output;
}

(function main() {
  if (!fs.existsSync(distDir)) {
    console.error('dist 不存在，请先运行 npm run build');
    process.exit(1);
  }
  const files = listFiles(distDir);
  BuildLogger.log('📦 dist 构建分析：');
  files.sort((a, b) => b.size - a.size);
  files.slice(0, 10).forEach(file => {
    BuildLogger.log(`${file.rel.padEnd(50)} ${(file.size / 1024).toFixed(1)} KB`);
  });
  BuildLogger.log(`合计文件 ${files.length} 个，总大小 ${(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1)} KB`);
})();
