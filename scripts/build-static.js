#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const BuildLogger = require('./logger');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

// 需要复制的静态目录/文件入口
const entries = [
  'index.html',
  'manifest.webmanifest',
  'robots.txt',
  'src'
];

// 需要额外复制到 dist 根目录的资源（浏览器默认请求 /favicon.ico）
const rootAssets = [
  { from: 'src/assets/favicon.ico', to: 'favicon.ico' },
  { from: 'llms.txt', to: 'llms.txt' }
];

// 生产构建禁止复制的文件过滤规则（安全防泄漏、防冗余）
const EXCLUDE_FILE_PATTERNS = [
  /\.md$/i,                          // 内部开发文档与架构指南（如 CLAUDE.md、MODULE_ARCHITECTURE.md）
  /_server\.js$/i,                   // 本地独立开发代理服务（如 simyo_proxy_server.js）
  /^example\.txt$/i,                 // 示例占位文件
  /-preview\.jpg$/i,                 // 仅供 GitHub README 展示的大图
  /^\.env(\..+)?$/i,                 // 环境变量配置文件（如 .env, .env.local）
  /\.(pem|key|crt|cert|p12|pfx)$/i,  // 证书与私钥文件
  /\.(bak|old|orig|swp|tmp|temp)$/i, // 备份与临时文件
  /\.(log|sqlite|db)$/i,             // 日志与本地数据库文件
  /\.map$/i                          // 源码映射文件
];

function shouldExclude(fileName) {
  return EXCLUDE_FILE_PATTERNS.some(pattern => pattern.test(fileName));
}

async function removeDist() {
  await fs.promises.rm(distDir, { recursive: true, force: true });
}

async function copyEntry(entry) {
  const from = path.join(projectRoot, entry);
  const to = path.join(distDir, entry);
  if (!fs.existsSync(from)) {
    console.warn(`⚠️  跳过不存在的入口: ${entry}`);
    return;
  }
  try {
    const stats = await fs.promises.stat(from);
    if (stats.isDirectory()) {
      await copyDirectory(from, to);
    } else {
      await fs.promises.mkdir(path.dirname(to), { recursive: true });
      await fs.promises.copyFile(from, to);
    }
  } catch (err) {
    console.error(`❌ 复制失败 ${entry}:`, err.message);
    throw err;
  }
}

async function copyDirectory(source, destination) {
  try {
    await fs.promises.mkdir(destination, { recursive: true });
    const dirEntries = await fs.promises.readdir(source, { withFileTypes: true });

    for (const entry of dirEntries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (shouldExclude(entry.name)) {
        continue;
      }

      try {
        if (entry.isDirectory()) {
          await copyDirectory(srcPath, destPath);
        } else if (entry.isFile()) {
          await fs.promises.copyFile(srcPath, destPath);
        }
      } catch (fileErr) {
        console.warn(`⚠️  跳过文件 ${entry.name}:`, fileErr.message);
        // 继续处理其他文件
      }
    }
  } catch (err) {
    throw new Error(`复制目录失败 ${source}: ${err.message}`);
  }
}

// 构建后产物安全校验（Denylist 与敏感信息扫描）
async function verifyDistSecurity(targetDir = distDir) {
  const violations = [];
  const SENSITIVE_TOKEN_PATTERNS = [
    /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/,
    /(?:["'=:\s])(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})/,
    /(?:["'=:\s])npm_[a-zA-Z0-9]{36}/,
    /(?:["'=:\s])(?:sk_live_|key_live_)[a-zA-Z0-9]{24,}/
  ];

  // 已知敏感凭据字面量扫描
  const KNOWN_PROHIBITED_LITERALS = [
    'e77b7e2f43db41bb95b17a2a11581a38' // Simyo Client Token
  ];

  // 动态收集环境中的真实密钥（若已配置且长度 >= 8，排查是否混入静态分发产物）
  const SENSITIVE_ENV_KEYS = [
    'ACCESS_KEY',
    'SIMYO_CLIENT_TOKEN',
    'GIFFGAFF_CLIENT_SECRET',
    'INTERNAL_FUNCTION_KEY'
  ];
  for (const envKey of SENSITIVE_ENV_KEYS) {
    const val = process.env[envKey];
    if (val && typeof val === 'string' && val.trim().length >= 8 && val !== 'please_change_me') {
      KNOWN_PROHIBITED_LITERALS.push(val.trim());
    }
  }

  async function scanDir(dir) {
    const dirEntries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of dirEntries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(targetDir, fullPath);

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile()) {
        for (const pattern of EXCLUDE_FILE_PATTERNS) {
          if (pattern.test(entry.name)) {
            violations.push(`[敏感文件泄露] ${relPath}`);
          }
        }
        // 扫描发布的静态文本文件（JS/HTML/JSON/CSS/TXT/XML/SVG/Webmanifest）中是否存在泄露的私钥或特权 Token
        if (/\.(js|html|json|css|txt|xml|svg|webmanifest)$/i.test(entry.name)) {
          const content = await fs.promises.readFile(fullPath, 'utf8');
          for (const tokenPattern of SENSITIVE_TOKEN_PATTERNS) {
            if (tokenPattern.test(content)) {
              violations.push(`[私钥/Token泄露风险] ${relPath}`);
            }
          }
          for (const literal of KNOWN_PROHIBITED_LITERALS) {
            if (content.includes(literal)) {
              violations.push(`[已知凭据泄露] ${relPath}`);
            }
          }
        }
      }
    }
  }

  await scanDir(targetDir);

  if (violations.length > 0) {
    throw new Error(`构建产物安全检查失败，发现以下违规文件:\n${violations.map(v => '  - ' + v).join('\n')}`);
  }
}

async function transpileDistJs() {
  const jsDir = path.join(distDir, 'src/js');
  if (!fs.existsSync(jsDir)) {
    return;
  }

  async function walkAndTranspile(dir) {
    const dirEntries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of dirEntries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkAndTranspile(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        try {
          const code = await fs.promises.readFile(fullPath, 'utf8');
          const transformed = await babel.transformAsync(code, {
            filename: fullPath,
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: '> 0.5%, last 2 versions, Firefox ESR, not dead',
                  modules: false
                }
              ]
            ],
            configFile: false,
            babelrc: false
          });
          if (transformed && transformed.code) {
            await fs.promises.writeFile(fullPath, transformed.code, 'utf8');
          }
        } catch (transpileErr) {
          console.warn(`⚠️  Babel 转译跳过 ${entry.name}:`, transpileErr.message);
        }
      }
    }
  }

  await walkAndTranspile(jsDir);
}

async function runBuild() {
  BuildLogger.log('🧹 清理 dist 目录...');
  await removeDist();
  await fs.promises.mkdir(distDir, { recursive: true });

  for (const entry of entries) {
    BuildLogger.log(`📦 复制 ${entry} -> dist/${entry}`);
    await copyEntry(entry);
  }

  // 复制根目录资源（如 favicon.ico）
  for (const { from, to } of rootAssets) {
    const srcPath = path.join(projectRoot, from);
    const destPath = path.join(distDir, to);
    if (fs.existsSync(srcPath)) {
      BuildLogger.log(`📎 复制 ${from} -> dist/${to}`);
      await fs.promises.copyFile(srcPath, destPath);
    } else {
      console.warn(`⚠️  根资源不存在: ${from}`);
    }
  }

  BuildLogger.log('🧩 转译 dist/src 下的 JS（browserslist 目标）...');
  await transpileDistJs();

  // 注入 Sentry 配置
  BuildLogger.log('🔧 注入 Sentry 配置...');
  require('./inject-sentry-config.js');

  // 生成 AI Agent 元数据文件
  BuildLogger.log('🤖 生成 Agent 元数据...');
  require('./generate-agent-metadata.js');

  // 构建后产物安全校验
  BuildLogger.log('🛡️  执行构建产物安全校验（Denylist & 敏感内容扫描）...');
  await verifyDistSecurity();

  BuildLogger.success('✨ 静态资源构建完成并通过安全校验，输出目录 dist/');
}

if (require.main === module) {
  runBuild().catch(err => {
    console.error('构建静态资源失败:', err);
    process.exitCode = 1;
  });
}

module.exports = {
  EXCLUDE_FILE_PATTERNS,
  shouldExclude,
  verifyDistSecurity,
  runBuild
};
