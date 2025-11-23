#!/usr/bin/env node
/**
 * 更新构建脚本中的console日志为BuildLogger
 * 仅替换普通的console.log,保留console.error和console.warn
 */

const fs = require('fs');
const path = require('path');

// 需要处理的脚本文件
const SCRIPTS_TO_UPDATE = [
  'build-static.js',
  'deploy-prepare.js',
  'deploy-analyze.js',
  'test-deploy-config.js',
  'optimize-images.js',
  'compress.js',
  'security-check.js'
];

// 需要排除的文件
const EXCLUDE_FILES = [
  'logger.js',
  'replace-console-log.js',
  'update-script-logging.js'
];

function updateScriptLogging(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // 检查是否已经导入了BuildLogger
    const hasLoggerImport = /const\s+(?:BuildLogger|Logger)\s*=\s*require/.test(content);

    // 检查是否有console.log需要替换
    const hasConsoleLog = /console\.log\s*\(/.test(content);

    if (!hasConsoleLog) {
      console.log(`⏭️  跳过 ${path.basename(filePath)} - 无console.log`);
      return { replaced: false };
    }

    // 替换console.log为BuildLogger.log
    // 识别带emoji的success消息
    content = content.replace(/console\.log\((['"`])✅([^'"`]*)\1\)/g, 'BuildLogger.success(\'$2\')');
    content = content.replace(/console\.log\((['"`])❌([^'"`]*)\1\)/g, 'BuildLogger.error(\'$2\')');
    content = content.replace(/console\.log\((['"`])⚠️([^'"`]*)\1\)/g, 'BuildLogger.warn(\'$2\')');
    content = content.replace(/console\.log\((['"`])🔧([^'"`]*)\1\)/g, 'BuildLogger.log(\'🔧$2\')');
    content = content.replace(/console\.log\((['"`])📊([^'"`]*)\1\)/g, 'BuildLogger.log(\'📊$2\')');

    // 替换剩余的console.log
    content = content.replace(/console\.log\s*\(/g, 'BuildLogger.log(');

    // 如果还没有导入BuildLogger,在文件开头添加导入
    if (!hasLoggerImport && hasConsoleLog) {
      // 在第一个require之后或文件开头添加
      const importStatement = `const BuildLogger = require('./logger.js');\n`;

      if (/^const\s+/.test(content)) {
        // 在最后一个require之后添加
        const lastRequireMatch = content.match(/const\s+\w+\s*=\s*require\([^)]+\);?/g);
        if (lastRequireMatch && lastRequireMatch.length > 0) {
          const lastRequire = lastRequireMatch[lastRequireMatch.length - 1];
          const lastRequireIndex = content.lastIndexOf(lastRequire);
          const insertIndex = lastRequireIndex + lastRequire.length;
          content = content.slice(0, insertIndex) + '\n' + importStatement + content.slice(insertIndex);
        } else {
          content = importStatement + content;
        }
      } else {
        content = importStatement + '\n' + content;
      }
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      const count = (originalContent.match(/console\.log\s*\(/g) || []).length;
      console.log(`✅ ${path.basename(filePath)} - 替换了${count}处console.log`);
      return { replaced: true, count };
    } else {
      console.log(`⏭️  跳过 ${path.basename(filePath)} - 无需修改`);
      return { replaced: false };
    }

  } catch (error) {
    console.error(`❌ 处理 ${path.basename(filePath)} 失败:`, error.message);
    return { replaced: false, error: true };
  }
}

function main() {
  console.log('🚀 开始更新构建脚本日志...\n');

  let totalFiles = 0;
  let replacedFiles = 0;
  let totalReplacements = 0;

  SCRIPTS_TO_UPDATE.forEach(filename => {
    const filePath = path.join(__dirname, filename);

    if (!fs.existsSync(filePath)) {
      console.log(`⏭️  跳过 ${filename} - 文件不存在`);
      return;
    }

    if (EXCLUDE_FILES.includes(filename)) {
      console.log(`⏭️  跳过 ${filename} - 已排除`);
      return;
    }

    totalFiles++;
    const result = updateScriptLogging(filePath);
    if (result.replaced) {
      replacedFiles++;
      totalReplacements += result.count || 0;
    }
  });

  console.log('\n📊 替换统计:');
  console.log(`   总文件数: ${totalFiles}`);
  console.log(`   已修改文件: ${replacedFiles}`);
  console.log(`   console.log替换数: ${totalReplacements}`);
  console.log('\n✨ 完成!');
  console.log('\n💡 提示: 构建脚本的日志现在使用带颜色的BuildLogger输出');
}

main();
