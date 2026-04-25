#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const BuildLogger = require('./logger.js');

const distSrcDir = path.join(__dirname, '..', 'dist', 'src');
const PRESET_ENV = require.resolve('@babel/preset-env');
const browserslist = require('browserslist');

// 从 browserslist 配置解析目标浏览器
function resolveBrowserslistTargets() {
  const query = [
    'defaults',
    'Chrome >= 90',
    'not dead'
  ];
  const browsers = browserslist(query);
  const targets = {};
  for (const entry of browsers) {
    const [name, version] = entry.split(' ');
    const major = parseInt(version.split('.')[0], 10);
    const mapped = {
      chrome: 'chrome', firefox: 'firefox', safari: 'safari',
      edge: 'edge', opera: 'opera', ios: 'ios', samsung: 'samsung',
      ie: 'ie', android: 'android'
    };
    const key = mapped[name];
    if (key && (!targets[key] || major < targets[key])) {
      targets[key] = major;
    }
  }
  return targets;
}

function shouldSkipFile(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  if (!normalized.endsWith('.js')) return true;
  if (/\.min\.js$/i.test(normalized)) return true;
  if (normalized.includes('/assets/vendor/')) return true;
  return false;
}

async function collectJsFiles(directory) {
  const result = [];
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectJsFiles(fullPath);
      result.push(...nested);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!shouldSkipFile(fullPath)) {
      result.push(fullPath);
    }
  }

  return result;
}

async function transpileFile(filePath) {
  const source = await fs.promises.readFile(filePath, 'utf8');
  const transformed = await babel.transformAsync(source, {
    filename: filePath,
    sourceType: 'unambiguous',
    babelrc: false,
    configFile: false,
    presets: [[PRESET_ENV, {
      targets: resolveBrowserslistTargets(),
      bugfixes: true,
      modules: false
    }]]
  });

  if (!transformed || typeof transformed.code !== 'string') {
    throw new Error(`Babel output is empty: ${filePath}`);
  }

  if (transformed.code !== source) {
    await fs.promises.writeFile(filePath, transformed.code, 'utf8');
    return true;
  }

  return false;
}

async function transpileDistJs() {
  if (!fs.existsSync(distSrcDir)) {
    BuildLogger.warn(`未找到目录，跳过转译: ${distSrcDir}`);
    return { total: 0, changed: 0 };
  }

  const files = await collectJsFiles(distSrcDir);
  let changed = 0;

  for (const file of files) {
    const isChanged = await transpileFile(file);
    if (isChanged) changed += 1;
  }

  BuildLogger.success(`JS 转译完成（browserslist 目标）：处理 ${files.length} 个文件，更新 ${changed} 个文件`);
  return { total: files.length, changed };
}

if (require.main === module) {
  transpileDistJs().catch((error) => {
    BuildLogger.error('JS 转译失败:', error.message);
    process.exitCode = 1;
  });
}

module.exports = transpileDistJs;
