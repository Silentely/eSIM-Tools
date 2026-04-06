#!/usr/bin/env node

/**
 * prepare-commit-msg:
 * 在未填写提交信息时，注入标准模板，降低格式输入错误概率。
 */

const fs = require('fs');

const TEMPLATE_HEADER = '✨ feat(core): 请填写中文描述';
const SKIP_SOURCES = new Set(['merge', 'squash', 'commit']);

function getFirstMeaningfulLine(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    return trimmed;
  }
  return '';
}

function main() {
  const messageFilePath = process.argv[2];
  const commitSource = process.argv[3] || '';

  if (!messageFilePath || SKIP_SOURCES.has(commitSource)) {
    return;
  }

  const original = fs.readFileSync(messageFilePath, 'utf8');
  const firstLine = getFirstMeaningfulLine(original);
  if (firstLine) {
    return;
  }

  const commentLines = original
    .split(/\r?\n/)
    .filter(line => line.trim().startsWith('#'));

  const content = [
    TEMPLATE_HEADER,
    '',
    '# 格式: <emoji> <type>(optional-scope): <中文描述>',
    '# 示例: 🐛 fix(simyo): 修复验证码重试逻辑',
    ...commentLines
  ].join('\n');

  fs.writeFileSync(messageFilePath, content, 'utf8');
}

main();
