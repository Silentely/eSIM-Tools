#!/usr/bin/env node
const BuildLogger = require('./logger.js');

const fs = require('fs');
const path = require('path');

const netlifyToml = path.join(__dirname, '..', 'netlify.toml');

(function main() {
  if (!fs.existsSync(netlifyToml)) {
    console.error('netlify.toml 不存在');
    process.exit(1);
  }
  const content = fs.readFileSync(netlifyToml, 'utf8');
  if (!/publish\s*=\s*"dist"/.test(content)) {
    console.error('netlify.toml 未将 publish 指向 dist');
    process.exit(1);
  }
  BuildLogger.success(' Netlify 配置检查通过 (publish=dist)');
})();
