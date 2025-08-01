#!/usr/bin/env node

/**
 * 标准版本构建脚本
 * 构建不带安全加固的原始版本
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始构建标准版本...');

// 构建配置
const buildConfig = {
    version: 'standard',
    security: false,
    description: '标准版本 - 原始功能，无安全加固'
};

// 创建构建目录
const buildDir = 'dist-standard';
if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
}
fs.mkdirSync(buildDir, { recursive: true });

// 复制标准版本文件
console.log('📁 复制标准版本文件...');

// 复制主要文件
const filesToCopy = [
    { src: 'versions/standard/src', dest: `${buildDir}/src` },
    { src: 'netlify/functions', dest: `${buildDir}/netlify/functions` },
    { src: 'package.json', dest: `${buildDir}/package.json` },
    { src: 'env.example', dest: `${buildDir}/env.example` }
];

filesToCopy.forEach(({ src, dest }) => {
    if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
        console.log(`✅ 复制: ${src} -> ${dest}`);
    }
});

// 创建标准版本的主页
const standardIndexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>eSIM工具 - 标准版本</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .main-container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            max-width: 800px;
            width: 100%;
            text-align: center;
        }
        .version-badge {
            background: #28a745;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.8rem;
            margin-bottom: 20px;
            display: inline-block;
        }
        .tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-top: 40px;
        }
        .tool-card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        .tool-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        .tool-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
        }
        .tool-btn:hover {
            transform: translateY(-2px);
            color: white;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="version-badge">标准版本</div>
        <h1><i class="fas fa-sim-card me-3"></i>eSIM工具集</h1>
        <p>轻松管理您的Giffgaff和Simyo eSIM配置</p>
        
        <div class="tools-grid">
            <div class="tool-card">
                <div style="font-size: 3rem; color: #ff6b00; margin-bottom: 20px;">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <h2>Giffgaff eSIM工具</h2>
                <p>完整的Giffgaff eSIM申请和管理工具</p>
                <ul style="text-align: left; margin: 20px 0;">
                    <li>OAuth 2.0 PKCE认证</li>
                    <li>邮件验证和MFA支持</li>
                    <li>GraphQL API集成</li>
                    <li>自动生成eSIM二维码</li>
                </ul>
                <a href="/src/giffgaff/giffgaff_complete_esim.html" class="tool-btn">
                    <i class="fas fa-arrow-right me-2"></i>使用Giffgaff工具
                </a>
            </div>

            <div class="tool-card">
                <div style="font-size: 3rem; color: #e74c3c; margin-bottom: 20px;">
                    <i class="fas fa-sim-card"></i>
                </div>
                <h2>Simyo工具</h2>
                <p>专为Simyo NL用户设计的eSIM管理工具</p>
                <ul style="text-align: left; margin: 20px 0;">
                    <li>简单的登录验证</li>
                    <li>设备更换流程</li>
                    <li>短信验证码支持</li>
                    <li>一键生成二维码</li>
                </ul>
                <a href="/src/simyo/simyo_complete_esim.html" class="tool-btn">
                    <i class="fas fa-arrow-right me-2"></i>使用Simyo工具
                </a>
            </div>
        </div>

        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #ecf0f1; color: #95a5a6;">
            <p>
                <i class="fas fa-info-circle me-2"></i>
                标准版本 - 原始功能，代码完全开源可见
            </p>
        </div>
    </div>
</body>
</html>`;

fs.writeFileSync(`${buildDir}/index.html`, standardIndexHtml);

// 创建标准版本的netlify.toml
const standardNetlifyConfig = `[build]
  command = "npm run build:standard"
  publish = "dist-standard"
  functions = "dist-standard/netlify/functions"

# 标准版本重定向
[[redirects]]
  from = "/giffgaff"
  to = "/src/giffgaff/giffgaff_complete_esim.html"
  status = 200

[[redirects]]
  from = "/simyo"
  to = "/src/simyo/simyo_complete_esim.html"
  status = 200

[[redirects]]
  from = "/"
  to = "/index.html"
  status = 200

# API代理重定向
[[redirects]]
  from = "/api/simyo/*"
  to = "https://appapi.simyo.nl/simyoapi/api/v1/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/api/giffgaff-id/*"
  to = "https://id.giffgaff.com/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/api/giffgaff-public/*"
  to = "https://publicapi.giffgaff.com/:splat"
  status = 200
  force = true

# 基础安全头部
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
`;

fs.writeFileSync(`${buildDir}/netlify.toml`, standardNetlifyConfig);

// 创建构建信息文件
const buildInfo = {
    version: buildConfig.version,
    buildTime: new Date().toISOString(),
    description: buildConfig.description,
    security: buildConfig.security,
    features: [
        'OAuth 2.0 PKCE认证',
        'MFA多因子验证',
        'GraphQL API集成',
        'eSIM二维码生成',
        'Simyo设备更换流程'
    ]
};

fs.writeFileSync(`${buildDir}/build-info.json`, JSON.stringify(buildInfo, null, 2));

console.log('✅ 标准版本构建完成！');
console.log(`📦 构建目录: ${buildDir}`);
console.log(`🔧 版本: ${buildConfig.version}`);
console.log(`📝 描述: ${buildConfig.description}`);
console.log('\n🚀 部署命令:');
console.log(`netlify deploy --dir ${buildDir} --functions ${buildDir}/netlify/functions`);