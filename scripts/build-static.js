#!/usr/bin/env node
const BuildLogger = require('./logger.js');

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const entries = [
  'index.html',
  'manifest.webmanifest',
  'src'
];

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
    const entries = await fs.promises.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

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

(async () => {
  BuildLogger.log('🧹 清理 dist 目录...');
  await removeDist();
  await fs.promises.mkdir(distDir, { recursive: true });

  for (const entry of entries) {
    BuildLogger.log(`📦 复制 ${entry} -> dist/${entry}`);
    await copyEntry(entry);
  }

  // 注入 Sentry 配置
  BuildLogger.log('🔧 注入 Sentry 配置...');
  require('./inject-sentry-config.js');

  BuildLogger.success(' 静态资源构建完成，输出目录 dist/');
})().catch(err => {
  console.error('构建静态资源失败:', err);
  process.exitCode = 1;
});
