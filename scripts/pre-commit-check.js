#!/usr/bin/env node

/**
 * pre-commit 检查：
 * 1) 仅处理 staged 文件，安全格式化（LF、行尾空白、文件尾换行）；
 * 2) 检查 staged JS 语法；
 * 3) 检查 staged JSON 语法；
 * 4) 拦截代码文件中的智能引号，避免引号边界问题；
 * 5) 保护 legacy 完整版页面，禁止提交其变更。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
let esbuild = null;
try {
  esbuild = require('esbuild');
} catch (_) {
  esbuild = null;
}

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.html',
  '.yml',
  '.yaml',
  '.sh'
]);

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const SMART_QUOTES_RE = /[\u2018\u2019\u201C\u201D]/u;
const PROTECTED_FILES = [];

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  });
}

function getStagedFiles() {
  const output = git([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    '-z'
  ]);
  return output.split('\0').filter(Boolean);
}

/**
 * List staged changes that match the repository's protected file paths.
 *
 * Runs a git diff against the index for the configured PROTECTED_FILES and returns
 * the matching paths.
 * @returns {string[]} An array of staged protected file paths relative to the repository root; empty if none.
 */
function getTouchedProtectedFiles() {
  const output = git([
    'diff',
    '--cached',
    '--name-only',
    '-z',
    '--',
    ...PROTECTED_FILES
  ]);
  return output.split('\0').filter(Boolean);
}

/**
 * Determine whether a staged file should be normalized/formatting applied.
 * @param {string} relPath - File path relative to the repository root.
 * @returns {boolean} `true` if the file is treated as text and should be normalized (including `.gitignore` and `.gitattributes`), `false` otherwise.
 */
function shouldFormat(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) {
    return true;
  }

  const baseName = path.basename(relPath);
  return baseName === '.gitignore' || baseName === '.gitattributes';
}

function normalizeText(content) {
  let next = content.replace(/\r\n/g, '\n');
  next = next.replace(/[ \t]+$/gm, '');
  if (next.length > 0 && !next.endsWith('\n')) {
    next += '\n';
  }
  return next;
}

function formatStagedFiles(stagedFiles) {
  const updated = [];
  for (const relPath of stagedFiles) {
    if (!shouldFormat(relPath)) {
      continue;
    }

    const absPath = path.resolve(relPath);
    if (!fs.existsSync(absPath)) {
      continue;
    }

    const original = fs.readFileSync(absPath, 'utf8');
    const normalized = normalizeText(original);
    if (normalized !== original) {
      fs.writeFileSync(absPath, normalized, 'utf8');
      git(['add', '--', relPath]);
      updated.push(relPath);
    }
  }

  return updated;
}

function readStagedContent(relPath) {
  return git(['show', `:${relPath}`]);
}

function fallbackNodeSyntaxCheck(relPath, content) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esim-precommit-'));
  const ext = path.extname(relPath).toLowerCase() || '.js';
  const tempFile = path.join(tempDir, `check${ext}`);

  try {
    fs.writeFileSync(tempFile, content, 'utf8');
    const result = spawnSync(process.execPath, ['--check', tempFile], {
      encoding: 'utf8'
    });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || '').trim());
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function checkJavaScriptSyntax(relPath, content) {
  if (esbuild) {
    esbuild.transformSync(content, {
      loader: 'js',
      sourcefile: relPath,
      charset: 'utf8'
    });
    return;
  }

  fallbackNodeSyntaxCheck(relPath, content);
}

function runChecks(stagedFiles) {
  const failures = [];

  for (const relPath of stagedFiles) {
    const ext = path.extname(relPath).toLowerCase();
    if (!JS_EXTENSIONS.has(ext) && ext !== '.json') {
      continue;
    }

    const content = readStagedContent(relPath);
    if (SMART_QUOTES_RE.test(content)) {
      failures.push(
        `${relPath}: 检测到智能引号（U+201C/U+201D/U+2018/U+2019），请改为标准半角引号。`
      );
      continue;
    }

    try {
      if (JS_EXTENSIONS.has(ext)) {
        checkJavaScriptSyntax(relPath, content);
      } else if (ext === '.json') {
        JSON.parse(content);
      }
    } catch (error) {
      failures.push(`${relPath}: ${error.message}`);
    }
  }

  return failures;
}

/**
 * Run the pre-commit validation workflow for staged files.
 *
 * Performs protected-file enforcement (exits with code 1 if protected files are touched),
 * normalizes/formats text files and re-stages any changes, and runs smart-quote detection
 * plus JavaScript/JSON syntax checks on staged content. Exits with code 1 if any checks fail;
 * exits with code 0 when there are no staged files or all checks pass.
 */
function main() {
  const touchedProtectedFiles = PROTECTED_FILES.length > 0 ? getTouchedProtectedFiles() : [];
  if (touchedProtectedFiles.length > 0) {
    console.error('\n❌ pre-commit 检查失败：');
    for (const relPath of touchedProtectedFiles) {
      console.error(`  - ${relPath}: 该文件受保护，禁止提交改动。`);
    }
    console.error('  - 如确需调整，请改为维护对应 modular 版本文件。');
    process.exit(1);
  }

  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  const formatted = formatStagedFiles(stagedFiles);
  if (formatted.length > 0) {
    console.log(`✅ 已格式化并重新暂存 ${formatted.length} 个文件`);
  }

  const failures = runChecks(stagedFiles);
  if (failures.length > 0) {
    console.error('\n❌ pre-commit 检查失败：');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('✅ pre-commit 检查通过');
}

main();
