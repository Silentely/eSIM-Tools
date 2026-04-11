#!/usr/bin/env node

/**
 * pre-push 检查：
 * 1) 先执行 pre-commit 级别检查，保证待推送内容格式与基础语法正确；
 * 2) 快速模式仅执行相关测试，全量模式执行完整测试。
 */

const { execFileSync, spawnSync } = require('child_process');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const RELATED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json']);
const PROTECTED_FILES = [
  'src/giffgaff/giffgaff_complete_esim.html',
  'src/simyo/simyo_complete_esim.html'
];

function runGit(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function resolveMode() {
  const argMode = process.argv
    .find(arg => arg.startsWith('--mode='))
    ?.split('=')[1];
  const envMode = process.env.PREPUSH_MODE;
  const mode = (argMode || envMode || 'full').toLowerCase();
  return mode === 'fast' ? 'fast' : 'full';
}

function getDiffRange() {
  try {
    const upstream = runGit([
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{upstream}'
    ]).trim();
    if (upstream) {
      return `${upstream}...HEAD`;
    }
  } catch (_) {
    // ignore and fallback
  }

  try {
    runGit(['rev-parse', '--verify', 'HEAD~1']);
    return 'HEAD~1..HEAD';
  } catch (_) {
    return null;
  }
}

function getRelatedFiles() {
  const range = getDiffRange();
  if (!range) {
    return [];
  }

  const output = runGit([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    '-z',
    range
  ]);
  const files = output.split('\0').filter(Boolean);

  return files.filter(file => {
    const lowerFile = file.toLowerCase();
    for (const ext of RELATED_EXTENSIONS) {
      if (lowerFile.endsWith(ext)) {
        return true;
      }
    }
    return false;
  });
}

function getTouchedProtectedFiles() {
  const range = getDiffRange();
  if (!range) {
    return [];
  }

  const output = runGit([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    '-z',
    range,
    '--',
    ...PROTECTED_FILES
  ]);

  return output.split('\0').filter(Boolean);
}

function buildSteps(mode) {
  const steps = [
    {
      name: 'pre-commit 检查',
      args: ['run', 'precommit:check']
    }
  ];

  if (mode === 'fast') {
    const relatedFiles = getRelatedFiles();
    if (relatedFiles.length > 0) {
      steps.push({
        name: `相关测试检查（${relatedFiles.length} 个文件）`,
        args: [
          'test',
          '--',
          '--bail',
          '--findRelatedTests',
          '--passWithNoTests',
          ...relatedFiles
        ]
      });
    } else {
      steps.push({
        name: '测试检查（未识别差异文件，回退全量测试）',
        args: ['test', '--', '--bail']
      });
    }
    return steps;
  }

  steps.push({
    name: '全量测试检查',
    args: ['test', '--', '--bail']
  });

  return steps;
}

function runStep(step) {
  console.log(`\n🔎 执行 ${step.name}...`);
  const result = spawnSync(npmCmd, step.args, {
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    console.error(`\n❌ ${step.name}未通过，已阻止 push。`);
    process.exit(result.status || 1);
  }
}

function main() {
  const mode = resolveMode();
  console.log(`\n🧭 pre-push 模式: ${mode}`);

  const touchedProtectedFiles = getTouchedProtectedFiles();
  if (touchedProtectedFiles.length > 0) {
    console.error('\n❌ pre-push 检查失败：');
    for (const relPath of touchedProtectedFiles) {
      console.error(`  - ${relPath}: 该文件受保护，禁止推送包含其改动的提交。`);
    }
    console.error('  - 如确需调整，请改为维护对应 modular 版本文件。');
    process.exit(1);
  }

  const steps = buildSteps(mode);

  for (const step of steps) {
    runStep(step);
  }
  console.log('\n✅ pre-push 检查全部通过');
}

main();
