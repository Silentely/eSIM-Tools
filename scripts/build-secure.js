#!/usr/bin/env node

/**
 * 安全版本构建脚本
 * 构建带有企业级安全加固的版本
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 开始构建安全版本...');

// 构建配置
const buildConfig = {
    version: 'secure',
    security: true,
    description: '企业级安全版本 - 多层防护，防逆向工程'
};

// 创建构建目录
const buildDir = 'dist-secure';
if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
}
fs.mkdirSync(buildDir, { recursive: true });

// 复制安全版本文件
console.log('🛡️ 复制安全版本文件...');

// 复制主要文件
const filesToCopy = [
    { src: 'versions/secure/src', dest: `${buildDir}/src` },
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

// 创建安全版本的主页
const secureIndexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>eSIM工具 - 企业级安全版本</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- 安全头部 -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self'; font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="X-Frame-Options" content="DENY">
    <meta http-equiv="X-XSS-Protection" content="1; mode=block">
    
    <style>
        /* 防止代码查看的样式 */
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
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
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
            padding: 8px 20px;
            border-radius: 25px;
            font-size: 0.9rem;
            margin-bottom: 20px;
            display: inline-block;
            box-shadow: 0 4px 15px rgba(220, 53, 69, 0.3);
        }
        .security-badge {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 5px 15px;
            border-radius: 15px;
            font-size: 0.7rem;
            margin-left: 10px;
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
            position: relative;
            overflow: hidden;
        }
        .tool-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #dc3545, #fd7e14);
        }
        .tool-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        .security-features {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
        }
        .security-features li {
            margin: 8px 0;
            color: #495057;
        }
        .security-features li::before {
            content: '🛡️';
            margin-right: 8px;
        }
        .tool-btn {
            background: linear-gradient(135deg, #dc3545, #fd7e14);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(220, 53, 69, 0.3);
        }
        .tool-btn:hover {
            transform: translateY(-2px);
            color: white;
            text-decoration: none;
            box-shadow: 0 8px 25px rgba(220, 53, 69, 0.4);
        }
        /* 防止选择和拖拽 */
        * { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
        input, textarea { -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; user-select: text; }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="version-badge">
            🔒 企业级安全版本
            <span class="security-badge">PROTECTED</span>
        </div>
        <h1><i class="fas fa-shield-alt me-3"></i>eSIM工具集</h1>
        <p>🛡️ 企业级安全保护的eSIM管理工具集</p>
        
        <div class="alert alert-info">
            <i class="fas fa-info-circle me-2"></i>
            此版本采用多层安全防护技术，确保您的数据绝对安全
        </div>
        
        <div class="tools-grid">
            <div class="tool-card">
                <div style="font-size: 3rem; color: #dc3545; margin-bottom: 20px;">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <h2>Giffgaff eSIM工具</h2>
                <p>🔒 企业级安全的Giffgaff eSIM申请工具</p>
                <div class="security-features">
                    <ul style="list-style: none; padding: 0;">
                        <li>企业级安全保护</li>
                        <li>加密OAuth认证</li>
                        <li>防调试保护</li>
                        <li>防爬虫机制</li>
                        <li>代码混淆保护</li>
                    </ul>
                </div>
                <a href="/src/giffgaff-secured.html" class="tool-btn">
                    <i class="fas fa-shield-alt me-2"></i>使用安全工具
                </a>
            </div>

            <div class="tool-card">
                <div style="font-size: 3rem; color: #dc3545; margin-bottom: 20px;">
                    <i class="fas fa-sim-card"></i>
                </div>
                <h2>Simyo工具</h2>
                <p>专为Simyo NL用户设计的安全eSIM工具</p>
                <div class="security-features">
                    <ul style="list-style: none; padding: 0;">
                        <li>安全登录验证</li>
                        <li>加密数据传输</li>
                        <li>会话保护机制</li>
                        <li>防护状态监控</li>
                        <li>智能威胁检测</li>
                    </ul>
                </div>
                <a href="/src/simyo/simyo_complete_esim.html" class="tool-btn">
                    <i class="fas fa-shield-alt me-2"></i>使用安全工具
                </a>
            </div>
        </div>

        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #ecf0f1; color: #6c757d;">
            <p>
                <i class="fas fa-shield-alt me-2"></i>
                <strong>企业级安全保护</strong> - 多层防护机制，防止逆向工程
                <br>
                <i class="fas fa-lock me-2"></i>
                所有敏感操作均在加密后端处理，前端零敏感信息暴露
            </p>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // 基础防护脚本
        (function() {
            'use strict';
            
            // 禁用右键菜单
            document.addEventListener('contextmenu', e => e.preventDefault());
            
            // 禁用开发者工具快捷键
            document.addEventListener('keydown', e => {
                if (e.key === 'F12' || 
                    (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                    (e.ctrlKey && e.key === 'U')) {
                    e.preventDefault();
                    alert('⚠️ 此应用受到安全保护');
                }
            });
            
            console.log('🔒 安全保护已激活');
        })();
    </script>
</body>
</html>`;

fs.writeFileSync(`${buildDir}/index.html`, secureIndexHtml);

// 创建安全版本的netlify.toml
const secureNetlifyConfig = `[build]
  command = "npm run build:secure"
  publish = "dist-secure"
  functions = "dist-secure/netlify/functions"

# 安全版本重定向
[[redirects]]
  from = "/giffgaff"
  to = "/src/giffgaff-secured.html"
  status = 200

[[redirects]]
  from = "/simyo"
  to = "/src/simyo/simyo_complete_esim.html"
  status = 200

[[redirects]]
  from = "/"
  to = "/index.html"
  status = 200

# 企业级安全头部
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
    Permissions-Policy = "geolocation=(), microphone=(), camera=(), payment=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self'; font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; object-src 'none'; base-uri 'self';"
    Cache-Control = "no-cache, no-store, must-revalidate"

# 安全页面额外保护
[[headers]]
  for = "/src/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow, noarchive, nosnippet"
    Cache-Control = "no-cache, no-store, must-revalidate, private"

# API端点安全头部
[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "POST, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type, X-Session-ID, X-Timestamp, X-Signature"
    Cache-Control = "no-cache, no-store, must-revalidate"
`;

fs.writeFileSync(`${buildDir}/netlify.toml`, secureNetlifyConfig);

// 创建构建信息文件
const buildInfo = {
    version: buildConfig.version,
    buildTime: new Date().toISOString(),
    description: buildConfig.description,
    security: buildConfig.security,
    securityFeatures: [
        '零敏感信息前端暴露',
        '多层防调试保护',
        '智能防爬虫机制',
        '代码混淆保护',
        '企业级安全头部',
        '防逆向工程',
        '请求签名验证',
        '会话加密管理'
    ],
    features: [
        '加密OAuth认证',
        '安全MFA验证',
        '保护的API调用',
        '安全eSIM生成',
        '防护状态监控'
    ]
};

fs.writeFileSync(`${buildDir}/build-info.json`, JSON.stringify(buildInfo, null, 2));

console.log('✅ 安全版本构建完成！');
console.log(`📦 构建目录: ${buildDir}`);
console.log(`🔒 版本: ${buildConfig.version}`);
console.log(`📝 描述: ${buildConfig.description}`);
console.log('\n🚀 部署命令:');
console.log(`netlify deploy --dir ${buildDir} --functions ${buildDir}/netlify/functions`);