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
const PROTECTED_FILES = [
  'src/giffgaff/giffgaff_complete_esim.html',
  'src/simyo/simyo_complete_esim.html'
];

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

function getUpstreamRef() {
  try {
    return git([
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}'
    ]).trim();
  } catch (_) {
    return '';
  }
}

function syncWithRemote() {
  const upstreamRef = getUpstreamRef();
  if (!upstreamRef) {
    console.log('ℹ️ 当前分支未配置 upstream，跳过远程同步');
    return;
  }

  console.log(`🔄 提交前同步远程更新（${upstreamRef}）...`);
  try {
    git(['pull', '--rebase', '--autostash', '--quiet'], {
      stdio: 'inherit'
    });
    console.log('✅ 远程更新同步完成');
  } catch (_) {
    console.error('\n❌ pre-commit 远程同步失败：');
    console.error('  - 请先手动执行 `git pull --rebase` 解决冲突后再提交。');
    process.exit(1);
  }
}

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

function main() {
  const touchedProtectedFiles = getTouchedProtectedFiles();
  if (touchedProtectedFiles.length > 0) {
    console.error('\n❌ pre-commit 检查失败：');
    for (const relPath of touchedProtectedFiles) {
      console.error(`  - ${relPath}: 该文件受保护，禁止提交改动。`);
    }
    console.error('  - 如确需调整，请改为维护对应 modular 版本文件。');
    process.exit(1);
  }

  syncWithRemote();

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
