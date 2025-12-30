#!/usr/bin/env node
/**
 * Legacy 页面冻结校验
 *
 * 目标：确保 /giffgaff-legacy 与 /simyo-legacy 对应的「旧页面源文件」不会被误改动。
 * - /giffgaff-legacy -> src/giffgaff/giffgaff_complete_esim.html
 * - /simyo-legacy    -> src/simyo/simyo_complete_esim.html
 *
 * 用法：
 * - 校验（默认）：node scripts/verify-legacy-frozen.js
 * - 更新基线：     node scripts/verify-legacy-frozen.js --update
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const baselinePath = path.join(__dirname, 'legacy-freeze.json');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function resolveProjectPath(relPath) {
  return path.join(projectRoot, relPath);
}

function computeFileHash(relPath) {
  const fullPath = resolveProjectPath(relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`missing file: ${relPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  return sha256(content);
}

function main() {
  const shouldUpdate = process.argv.includes('--update');

  if (!fs.existsSync(baselinePath)) {
    console.error(`[Legacy Freeze] ✗ 基线文件不存在: ${path.relative(projectRoot, baselinePath)}`);
    process.exitCode = 1;
    return;
  }

  const baseline = readJson(baselinePath);
  const algorithm = baseline.algorithm || 'sha256';

  if (algorithm !== 'sha256') {
    console.error(`[Legacy Freeze] ✗ 不支持的 hash 算法: ${algorithm}`);
    process.exitCode = 1;
    return;
  }

  const fileMap = baseline.files || {};
  const fileEntries = Object.entries(fileMap);
  if (fileEntries.length === 0) {
    console.error('[Legacy Freeze] ✗ 基线 files 为空，无法校验');
    process.exitCode = 1;
    return;
  }

  if (shouldUpdate) {
    const next = { algorithm: 'sha256', files: {} };
    for (const [relPath] of fileEntries) {
      next.files[relPath] = computeFileHash(relPath);
    }
    writeJson(baselinePath, next);
    console.log(`[Legacy Freeze] ✓ 已更新基线: ${path.relative(projectRoot, baselinePath)}`);
    return;
  }

  let hasMismatch = false;
  for (const [relPath, expected] of fileEntries) {
    let actual;
    try {
      actual = computeFileHash(relPath);
    } catch (err) {
      console.error(`[Legacy Freeze] ✗ 缺失文件: ${relPath} (${err.message})`);
      hasMismatch = true;
      continue;
    }

    if (actual !== expected) {
      console.error(`[Legacy Freeze] ✗ 文件已变更（冻结保护触发）: ${relPath}`);
      console.error(`  expected: ${expected}`);
      console.error(`  actual:   ${actual}`);
      hasMismatch = true;
    } else {
      console.log(`[Legacy Freeze] ✓ OK: ${relPath}`);
    }
  }

  if (hasMismatch) {
    console.error('[Legacy Freeze] 解决方式：如需有意更新旧页面，请运行：node scripts/verify-legacy-frozen.js --update');
    process.exitCode = 1;
  }
}

main();

