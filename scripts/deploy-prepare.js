#!/usr/bin/env node
const BuildLogger = require('./logger.js');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

function ensureAccessKey() {
  const key = process.env.ACCESS_KEY;
  if (!key) {
    throw new Error('ACCESS_KEY 未配置，无法保护 Functions。');
  }
}

function ensureDist() {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('dist 目录缺少 index.html，请先运行 npm run build。');
  }
}

(function main() {
  BuildLogger.log('🔧 检查部署前置条件...');
  ensureAccessKey();
  ensureDist();
  BuildLogger.success(' 部署前检查通过，可继续执行部署流程');
})();
