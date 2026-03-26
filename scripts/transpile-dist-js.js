#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const BuildLogger = require('./logger.js');

const distSrcDir = path.join(__dirname, '..', 'dist', 'src');
const PRESET_ENV = require.resolve('@babel/preset-env');

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
      targets: { chrome: '77' },
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

  BuildLogger.success(`JS 转译完成（Chrome 77 目标）：处理 ${files.length} 个文件，更新 ${changed} 个文件`);
  return { total: files.length, changed };
}

if (require.main === module) {
  transpileDistJs().catch((error) => {
    BuildLogger.error('JS 转译失败:', error.message);
    process.exitCode = 1;
  });
}

module.exports = transpileDistJs;
