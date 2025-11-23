#!/usr/bin/env node
/**
 * 代码质量全面检查脚本
 * 检查所有变更的完整性和代码质量
 */

const BuildLogger = require('./logger.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');

// 检查项配置
const checks = {
  // 1. 语法检查
  syntaxCheck: {
    name: '语法检查',
    files: [
      'server.js',
      'webpack.config.js',
      'netlify/functions/_shared/middleware.js',
      'netlify/functions/health.js',
      'netlify/functions/giffgaff-graphql.js',
      'netlify/functions/giffgaff-mfa-challenge.js',
      'netlify/functions/giffgaff-mfa-validation.js',
      'netlify/functions/giffgaff-sms-activate.js',
      'netlify/functions/auto-activate-esim.js',
      'netlify/functions/giffgaff-token-exchange.js',
      'netlify/functions/verify-cookie.js'
    ]
  },

  // 2. 环境变量一致性
  envVarCheck: {
    name: '环境变量一致性',
    required: ['ACCESS_KEY', 'ALLOWED_ORIGIN'],
    deprecated: ['ESIM_ACCESS_KEY', 'COOKIE_SECRET']
  },

  // 3. 依赖完整性
  dependencyCheck: {
    name: '依赖完整性',
    unused: ['cookie-parser']
  },

  // 4. 安全配置
  securityCheck: {
    name: '安全配置',
    patterns: {
      weakDefaults: /please_change_me|your-secret-key-here|your-key-here/g,
      hardcodedSecrets: /(?:password|secret|key)\s*=\s*['"][^'"]{10,}['"]/gi,
      consoleLog: /console\.log\(/g
    }
  }
};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

// 辅助函数
function checkFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) {
    BuildLogger.error(`文件不存在: ${filePath}`);
    return false;
  }

  try {
    execSync(`node -c "${fullPath}"`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    BuildLogger.error(`语法错误: ${filePath}`);
    BuildLogger.error(error.message);
    return false;
  }
}

function checkEnvExample() {
  const envPath = path.join(projectRoot, 'env.example');
  const content = fs.readFileSync(envPath, 'utf8');
  const issues = [];

  // 检查必需变量
  checks.envVarCheck.required.forEach(varName => {
    if (!content.includes(`${varName}=`)) {
      issues.push(`缺少必需环境变量: ${varName}`);
    }
  });

  // 检查废弃变量
  checks.envVarCheck.deprecated.forEach(varName => {
    if (content.includes(`${varName}=`)) {
      issues.push(`包含废弃环境变量: ${varName}`);
    }
  });

  return issues;
}

function searchInFiles(pattern, files, excludeContext = []) {
  const results = [];
  files.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      let matchCount = 0;

      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          // 检查是否在排除的上下文中（如安全检查代码）
          const isExcluded = excludeContext.some(ctx => {
            const contextLine = lines[index];
            const prevLine = lines[index - 1] || '';
            return contextLine.includes(ctx) || prevLine.includes(ctx);
          });

          if (!isExcluded) {
            matchCount++;
          }
        }
      });

      if (matchCount > 0) {
        results.push({ file, matches: matchCount });
      }
    }
  });
  return results;
}

function checkPackageJson() {
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const issues = [];

  checks.dependencyCheck.unused.forEach(dep => {
    if (pkg.dependencies && pkg.dependencies[dep]) {
      issues.push(`未使用的依赖: ${dep} (dependencies)`);
    }
    if (pkg.devDependencies && pkg.devDependencies[dep]) {
      issues.push(`未使用的依赖: ${dep} (devDependencies)`);
    }
  });

  return issues;
}

// 执行检查
function runChecks() {
  BuildLogger.title('代码质量全面检查');

  // 1. 语法检查
  BuildLogger.step(1, 4, checks.syntaxCheck.name);
  let syntaxPassed = 0;
  checks.syntaxCheck.files.forEach(file => {
    totalChecks++;
    if (checkFile(file)) {
      BuildLogger.check(true, file);
      syntaxPassed++;
      passedChecks++;
    } else {
      BuildLogger.check(false, file);
      failedChecks++;
    }
  });
  BuildLogger.progress(`${syntaxPassed}/${checks.syntaxCheck.files.length} 文件通过语法检查\n`);

  // 2. 环境变量检查
  BuildLogger.step(2, 4, checks.envVarCheck.name);
  totalChecks++;
  const envIssues = checkEnvExample();
  if (envIssues.length === 0) {
    BuildLogger.check(true, 'env.example 配置正确');
    passedChecks++;
  } else {
    BuildLogger.check(false, 'env.example 存在问题:');
    envIssues.forEach(issue => BuildLogger.error(`  - ${issue}`));
    failedChecks++;
  }

  // 3. 依赖检查
  BuildLogger.step(3, 4, checks.dependencyCheck.name);
  totalChecks++;
  const depIssues = checkPackageJson();
  if (depIssues.length === 0) {
    BuildLogger.check(true, 'package.json 依赖正确');
    passedChecks++;
  } else {
    BuildLogger.check(false, 'package.json 存在问题:');
    depIssues.forEach(issue => BuildLogger.warn(`  - ${issue}`));
    failedChecks++;
  }

  // 4. 安全配置检查
  BuildLogger.step(4, 4, checks.securityCheck.name);

  // 检查弱密钥（排除安全检查代码中的引用）
  totalChecks++;
  const weakDefaults = searchInFiles(
    checks.securityCheck.patterns.weakDefaults,
    ['env.example', 'netlify/functions/_shared/middleware.js'],
    ['if (ACCESS_KEY ===', '安全警告', '警告', '检查']
  );
  if (weakDefaults.length === 0) {
    BuildLogger.check(true, '无弱默认配置');
    passedChecks++;
  } else {
    BuildLogger.check(false, '发现弱默认配置:');
    weakDefaults.forEach(r => BuildLogger.warn(`  - ${r.file}: ${r.matches}处`));
    failedChecks++;
  }

  // 统计报告
  BuildLogger.title('\n检查结果汇总');
  BuildLogger.log(`总检查项: ${totalChecks}`);
  BuildLogger.success(`通过: ${passedChecks}`);
  if (failedChecks > 0) {
    BuildLogger.error(`失败: ${failedChecks}`);
  }

  const successRate = ((passedChecks / totalChecks) * 100).toFixed(1);
  BuildLogger.log(`\n通过率: ${successRate}%`);

  if (failedChecks === 0) {
    BuildLogger.success('\n✅ 所有检查通过! 代码质量良好。');
    return 0;
  } else {
    BuildLogger.error('\n❌ 存在质量问题，请修复后重新检查。');
    return 1;
  }
}

// 执行
const exitCode = runChecks();
process.exit(exitCode);
