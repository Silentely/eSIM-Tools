#!/usr/bin/env node

/**
 * commit-msg 校验：
 * 1. 首段必须为 emoji（或 :shortcode:）；
 * 2. 后续遵循 Conventional Commits 头部格式；
 * 3. emoji 与 type 仅要求分别合法，不再强制一一匹配；
 * 4. 描述必须包含中文字符。
 *
 * 格式：<emoji> <type>(optional-scope): <中文描述>
 * 示例：✨ feat(auth): 新增登录态自动续期
 */

const fs = require('fs');

const COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert'
];

const TYPE_TO_EMOJI = {
  feat: ['✨', ':sparkles:'],
  fix: ['🐛', ':bug:'],
  docs: ['📝', ':memo:'],
  style: ['💄', ':lipstick:'],
  refactor: ['♻️', '♻', ':recycle:'],
  perf: ['⚡️', '⚡', ':zap:'],
  test: ['✅', ':white_check_mark:'],
  build: ['📦', ':package:'],
  ci: ['👷', ':construction_worker:'],
  chore: ['🔧', '🧹', ':wrench:', ':broom:'],
  revert: ['⏪️', '⏪', ':rewind:']
};

const TOKEN_TO_TYPES = new Map();
for (const [type, tokens] of Object.entries(TYPE_TO_EMOJI)) {
  for (const token of tokens) {
    const key = token.startsWith(':')
      ? token.toLowerCase()
      : token.replace(/\uFE0F/g, '');
    if (!TOKEN_TO_TYPES.has(key)) {
      TOKEN_TO_TYPES.set(key, []);
    }
    TOKEN_TO_TYPES.get(key).push(type);
  }
}

const HEADER_PATTERN = new RegExp(
  `^(${COMMIT_TYPES.join('|')})(\\([a-z0-9._/-]+\\))?:\\s(.+)$`,
  'u'
);

const ALLOWED_PAIRS_HELP = Object.entries(TYPE_TO_EMOJI)
  .map(([type, tokens]) => `${type}: ${tokens.join(' / ')}`)
  .join('\n  ');

function fail(message) {
  console.error('\n❌ 提交信息格式不符合规范：');
  console.error(`   ${message}\n`);
  console.error('期望格式：');
  console.error('  <emoji> <type>(optional-scope): <中文描述>');
  console.error('\n支持的 emoji（推荐对应关系如下，非强制）：');
  console.error(`  ${ALLOWED_PAIRS_HELP}`);
  console.error('\n示例：');
  console.error('  ✨ feat(auth): 新增登录态自动续期');
  console.error('  🐛 fix(simyo): 修复验证码重试逻辑');
  console.error('  📝 docs(readme): 更新安装说明\n');
  process.exit(1);
}

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

function isEmojiToken(token) {
  const key = token.startsWith(':')
    ? token.toLowerCase()
    : token.replace(/\uFE0F/g, '');
  return TOKEN_TO_TYPES.has(key);
}

function validateEmojiToken(emojiToken) {
  const key = emojiToken.startsWith(':')
    ? emojiToken.toLowerCase()
    : emojiToken.replace(/\uFE0F/g, '');
  if (!TOKEN_TO_TYPES.has(key)) {
    fail(`不支持的 emoji：${emojiToken}`);
  }
}

function validateCommitHeader(header) {
  if (!header) {
    fail('提交标题为空。');
  }

  // 允许 git 自动生成的合并/回滚信息
  if (header.startsWith('Merge ') || header.startsWith('Revert "')) {
    return;
  }

  const firstSpaceIndex = header.indexOf(' ');
  if (firstSpaceIndex <= 0) {
    fail('缺少 emoji 前缀，或未使用空格分隔。');
  }

  const emojiToken = header.slice(0, firstSpaceIndex).trim();
  const conventionalHeader = header.slice(firstSpaceIndex + 1).trim();

  if (!isEmojiToken(emojiToken)) {
    fail('提交标题需要以受支持的 emoji（或 :shortcode:）开头。');
  }
  validateEmojiToken(emojiToken);

  const matched = conventionalHeader.match(HEADER_PATTERN);
  if (!matched) {
    fail(
      `类型段不合法。请使用 ${COMMIT_TYPES.join(
        ', '
      )} 之一，并遵循 type(scope): subject 格式。`
    );
  }

  const subject = matched[3].trim();
  if (!/[\u3400-\u9FFF]/u.test(subject)) {
    fail('提交描述必须包含中文字符。');
  }
}

function main() {
  const messageFilePath = process.argv[2];
  if (!messageFilePath) {
    fail('未接收到 commit message 文件路径。');
  }

  const content = fs.readFileSync(messageFilePath, 'utf8');
  const header = getFirstMeaningfulLine(content);
  validateCommitHeader(header);
}

main();
