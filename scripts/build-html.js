#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 简单的HTML压缩函数
function minifyHTML(html) {
    return html
        .replace(/\s+/g, ' ') // 合并多个空白字符
        .replace(/>\s+</g, '><') // 移除标签间的空白
        .replace(/\s*\/>/g, '/>') // 移除自闭合标签前的空白
        .replace(/\s*>/g, '>') // 移除开始标签后的空白
        .replace(/<\s*/g, '<') // 移除结束标签前的空白
        .replace(/\s*=\s*/g, '=') // 移除属性等号周围的空白
        .replace(/\s*:\s*/g, ':') // 移除CSS属性冒号周围的空白
        .replace(/\s*;\s*/g, ';') // 移除CSS分号周围的空白
        .replace(/\s*{\s*/g, '{') // 移除CSS大括号周围的空白
        .replace(/\s*}\s*/g, '}') // 移除CSS大括号周围的空白
        .trim();
}

// 创建dist目录
function ensureDistDir() {
    const distDir = path.join(__dirname, '../dist');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    return distDir;
}

// 复制并压缩HTML文件
function buildHTML() {
    console.log('🔨 开始构建HTML文件...');
    
    const distDir = ensureDistDir();
    const htmlFiles = [
        { src: 'index.html', dest: 'index.html' },
        { src: 'src/giffgaff/giffgaff_complete_esim.html', dest: 'giffgaff.html' },
        { src: 'src/simyo/simyo_complete_esim.html', dest: 'simyo.html' }
    ];
    
    htmlFiles.forEach(file => {
        const srcPath = path.join(__dirname, '..', file.src);
        const destPath = path.join(distDir, file.dest);
        
        if (fs.existsSync(srcPath)) {
            try {
                let content = fs.readFileSync(srcPath, 'utf8');
                
                // 压缩HTML
                content = minifyHTML(content);
                
                // 写入压缩后的文件
                fs.writeFileSync(destPath, content);
                console.log(`   ✅ ${file.src} -> ${file.dest}`);
                
                // 计算压缩率
                const originalSize = fs.statSync(srcPath).size;
                const compressedSize = fs.statSync(destPath).size;
                const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
                console.log(`      📊 压缩率: ${compressionRatio}% (${originalSize} -> ${compressedSize} bytes)`);
                
            } catch (error) {
                console.error(`   ❌ 处理 ${file.src} 时出错:`, error.message);
            }
        } else {
            console.log(`   ⚠️  文件不存在: ${file.src}`);
        }
    });
    
    console.log('✅ HTML构建完成！');
}

// 生成构建报告
function generateBuildReport() {
    const distDir = path.join(__dirname, '../dist');
    const reportPath = path.join(distDir, 'build-report.json');
    
    const report = {
        timestamp: new Date().toISOString(),
        files: [],
        totalSize: 0,
        totalCompressedSize: 0
    };
    
    if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir);
        files.forEach(file => {
            const filePath = path.join(distDir, file);
            const stats = fs.statSync(filePath);
            report.files.push({
                name: file,
                size: stats.size,
                modified: stats.mtime.toISOString()
            });
            report.totalSize += stats.size;
        });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('📋 构建报告已生成');
}

// 主函数
function main() {
    try {
        buildHTML();
        generateBuildReport();
        console.log('\n🎉 构建完成！');
        console.log('📁 输出目录: dist/');
        console.log('📋 构建报告: dist/build-report.json');
    } catch (error) {
        console.error('❌ 构建失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    buildHTML,
    generateBuildReport,
    minifyHTML
}; 