#!/usr/bin/env node
/**
 * 全局替换console.log为Logger
 * 自动在文件开头添加Logger导入,并替换所有console.log调用
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 需要处理的目录
const DIRS_TO_PROCESS = [
  'src/js/modules',
  'src/giffgaff/js/modules',
  'src/simyo/js/modules'
];

// 需要排除的文件
const EXCLUDE_FILES = [
  'src/js/modules/logger.js', // Logger模块本身
  'src/js/modules/README.md'  // 文档文件
];

// 替换console.log为Logger.log
function replaceConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // 检查是否已经导入了Logger
    const hasLoggerImport = /import\s+Logger\s+from/.test(content) ||
                           /const\s+Logger\s*=\s*require/.test(content);

    // 检查是否有console.log需要替换
    const hasConsolelog = /console\.log\s*\(/.test(content);

    if (!hasConsolelog) {
      console.log(`⏭️  跳过 ${filePath} - 无console.log`);
      return { replaced: false };
    }

    // 替换console.log为Logger.log
    // 保留console.warn和console.error不变
    content = content.replace(/console\.log\s*\(/g, 'Logger.log(');

    // 如果还没有导入Logger,在文件开头添加导入
    if (!hasLoggerImport && hasConsolelog) {
      // 计算相对路径
      const fileDir = path.dirname(filePath);
      const loggerPath = path.relative(fileDir, 'src/js/modules/logger.js');
      const importPath = loggerPath.startsWith('.') ? loggerPath : `./${loggerPath}`;

      // 添加导入语句
      const importStatement = `import Logger from '${importPath}';\n`;

      // 在第一个import语句后或文件开头添加
      if (/^import\s+/.test(content)) {
        // 在最后一个import之后添加
        const lastImportIndex = content.lastIndexOf('\nimport ');
        if (lastImportIndex !== -1) {
          const nextLineIndex = content.indexOf('\n', lastImportIndex + 1);
          content = content.slice(0, nextLineIndex + 1) + importStatement + content.slice(nextLineIndex + 1);
        } else {
          content = importStatement + content;
        }
      } else {
        // 在文件开头添加
        content = importStatement + '\n' + content;
      }
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      const count = (originalContent.match(/console\.log\s*\(/g) || []).length;
      console.log(`✅ ${filePath} - 替换了${count}处console.log`);
      return { replaced: true, count };
    } else {
      console.log(`⏭️  跳过 ${filePath} - 无需修改`);
      return { replaced: false };
    }

  } catch (error) {
    console.error(`❌ 处理 ${filePath} 失败:`, error.message);
    return { replaced: false, error: true };
  }
}

// 主函数
function main() {
  console.log('🚀 开始替换console.log为Logger.log...\n');

  let totalFiles = 0;
  let replacedFiles = 0;
  let totalReplacements = 0;

  DIRS_TO_PROCESS.forEach(dir => {
    const pattern = path.join(dir, '**/*.js');
    const files = glob.sync(pattern);

    files.forEach(file => {
      // 排除特定文件
      if (EXCLUDE_FILES.some(excluded => file.includes(excluded))) {
        return;
      }

      totalFiles++;
      const result = replaceConsoleLogs(file);
      if (result.replaced) {
        replacedFiles++;
        totalReplacements += result.count || 0;
      }
    });
  });

  console.log('\n📊 替换统计:');
  console.log(`   总文件数: ${totalFiles}`);
  console.log(`   已修改文件: ${replacedFiles}`);
  console.log(`   console.log替换数: ${totalReplacements}`);
  console.log('\n✨ 完成!');
}

main();
