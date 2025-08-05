#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 已知的安全漏洞列表
const knownVulnerabilities = {
  'tar-fs': {
    versions: ['<2.1.1', '<3.0.4'],
    description: 'Path traversal vulnerability',
    severity: 'High',
    fix: 'Update to latest version'
  },
  'got': {
    versions: ['<12.0.0'],
    description: 'Redirect to UNIX socket vulnerability',
    severity: 'Moderate',
    fix: 'Update to version 12.0.0 or later'
  },
  'ipx': {
    versions: ['<2.1.0'],
    description: 'Path traversal via prefix matching bypass',
    severity: 'Moderate',
    fix: 'Update to version 2.1.0 or later'
  },
  'http-proxy-middleware': {
    versions: ['<2.0.7'],
    description: 'writeBody called twice vulnerability',
    severity: 'Moderate',
    fix: 'Update to version 2.0.7 or later'
  },
  'esbuild': {
    versions: ['<0.19.0'],
    description: 'Development server security issue',
    severity: 'Moderate',
    fix: 'Update to version 0.19.0 or later'
  },
  'on-headers': {
    versions: ['<1.1.0'],
    description: 'HTTP response header manipulation',
    severity: 'Low',
    fix: 'Update to version 1.1.0 or later'
  }
};

// 检查版本是否在漏洞范围内
function isVulnerable(version, vulnerableVersions) {
  const semver = require('semver');
  return vulnerableVersions.some(range => semver.satisfies(version, range));
}

// 解析package-lock.json
function parsePackageLock() {
  try {
    const packageLockPath = path.join(__dirname, '../package-lock.json');
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
    return packageLock.dependencies || {};
  } catch (error) {
    console.error('Error reading package-lock.json:', error.message);
    return {};
  }
}

// 检查依赖包的安全状态
function checkDependencies() {
  const dependencies = parsePackageLock();
  const vulnerabilities = [];

  Object.keys(dependencies).forEach(pkgName => {
    const pkg = dependencies[pkgName];
    const version = pkg.version;
    
    if (knownVulnerabilities[pkgName]) {
      const vuln = knownVulnerabilities[pkgName];
      if (isVulnerable(version, vuln.versions)) {
        vulnerabilities.push({
          package: pkgName,
          version: version,
          description: vuln.description,
          severity: vuln.severity,
          fix: vuln.fix
        });
      }
    }
  });

  return vulnerabilities;
}

// 生成安全报告
function generateSecurityReport() {
  console.log('🔒 安全检查报告\n');
  
  const vulnerabilities = checkDependencies();
  
  if (vulnerabilities.length === 0) {
    console.log('✅ 未发现已知的安全漏洞');
    return;
  }

  console.log(`⚠️  发现 ${vulnerabilities.length} 个潜在安全漏洞:\n`);
  
  vulnerabilities.forEach((vuln, index) => {
    console.log(`${index + 1}. ${vuln.package}@${vuln.version}`);
    console.log(`   严重程度: ${vuln.severity}`);
    console.log(`   描述: ${vuln.description}`);
    console.log(`   修复建议: ${vuln.fix}\n`);
  });

  console.log('🔧 修复建议:');
  console.log('1. 运行 npm update 更新所有依赖');
  console.log('2. 运行 npm audit fix 自动修复');
  console.log('3. 手动更新特定包到最新版本');
}

// 检查开发环境安全配置
function checkSecurityConfig() {
  console.log('\n🔧 安全配置检查:\n');
  
  // 检查Helmet配置
  const serverPath = path.join(__dirname, '../server.js');
  if (fs.existsSync(serverPath)) {
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    if (serverContent.includes('helmet')) {
      console.log('✅ Helmet安全头已配置');
    } else {
      console.log('⚠️  建议添加Helmet安全头');
    }
  }

  // 检查CORS配置
  if (fs.existsSync(serverPath)) {
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    if (serverContent.includes('cors')) {
      console.log('✅ CORS配置已设置');
    } else {
      console.log('⚠️  建议配置CORS');
    }
  }

  // 检查Content Security Policy
  const htmlFiles = [
    'index.html',
    'src/giffgaff/giffgaff_complete_esim.html',
    'src/simyo/simyo_complete_esim.html'
  ];

  htmlFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('Content-Security-Policy')) {
        console.log(`✅ ${file} 已配置CSP`);
      } else {
        console.log(`⚠️  ${file} 建议添加CSP配置`);
      }
    }
  });
}

// 主函数
function main() {
  generateSecurityReport();
  checkSecurityConfig();
  
  console.log('\n📋 安全最佳实践:');
  console.log('1. 定期更新依赖包');
  console.log('2. 使用npm audit检查安全漏洞');
  console.log('3. 配置适当的安全头');
  console.log('4. 实施内容安全策略(CSP)');
  console.log('5. 使用HTTPS部署');
}

if (require.main === module) {
  main();
}

module.exports = { checkDependencies, generateSecurityReport }; 