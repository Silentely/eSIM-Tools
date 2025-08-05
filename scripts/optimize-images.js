#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 检查是否安装了必要的工具
function checkDependencies() {
  try {
    execSync('which convert', { stdio: 'ignore' });
    console.log('✅ ImageMagick found');
  } catch (error) {
    console.log('❌ ImageMagick not found. Please install ImageMagick first.');
    console.log('   macOS: brew install imagemagick');
    console.log('   Ubuntu: sudo apt-get install imagemagick');
    process.exit(1);
  }
}

// 创建目录
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 生成不同尺寸的图标
function generateIcons() {
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const iconDir = path.join(__dirname, '../public/icons');
  
  ensureDir(iconDir);
  
  // 创建一个简单的SVG图标作为基础
  const svgIcon = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="80" fill="url(#grad)"/>
      <path d="M256 128c-70.7 0-128 57.3-128 128s57.3 128 128 128 128-57.3 128-128-57.3-128-128-128zm0 224c-53 0-96-43-96-96s43-96 96-96 96 43 96 96-43 96-96 96z" fill="white"/>
      <circle cx="256" cy="256" r="32" fill="white"/>
    </svg>
  `;
  
  const svgPath = path.join(iconDir, 'icon.svg');
  fs.writeFileSync(svgPath, svgIcon);
  
  console.log('📱 Generating app icons...');
  
  sizes.forEach(size => {
    const outputPath = path.join(iconDir, `icon-${size}x${size}.png`);
    try {
      execSync(`convert -background transparent -size ${size}x${size} ${svgPath} ${outputPath}`);
      console.log(`   ✅ ${size}x${size} icon created`);
    } catch (error) {
      console.log(`   ❌ Failed to create ${size}x${size} icon`);
    }
  });
  
  // 生成WebP版本
  sizes.forEach(size => {
    const pngPath = path.join(iconDir, `icon-${size}x${size}.png`);
    const webpPath = path.join(iconDir, `icon-${size}x${size}.webp`);
    try {
      execSync(`convert ${pngPath} -quality 85 ${webpPath}`);
      console.log(`   ✅ ${size}x${size} WebP icon created`);
    } catch (error) {
      console.log(`   ❌ Failed to create ${size}x${size} WebP icon`);
    }
  });
}

// 优化现有图片
function optimizeImages() {
  const imageDir = path.join(__dirname, '../src/assets');
  const optimizedDir = path.join(__dirname, '../public/images');
  
  if (!fs.existsSync(imageDir)) {
    console.log('📁 No images directory found, creating sample images...');
    ensureDir(imageDir);
    return;
  }
  
  ensureDir(optimizedDir);
  
  console.log('🖼️  Optimizing images...');
  
  const imageFiles = fs.readdirSync(imageDir).filter(file => 
    /\.(jpg|jpeg|png|gif)$/i.test(file)
  );
  
  imageFiles.forEach(file => {
    const inputPath = path.join(imageDir, file);
    const nameWithoutExt = path.parse(file).name;
    
    // 生成WebP版本
    const webpPath = path.join(optimizedDir, `${nameWithoutExt}.webp`);
    try {
      execSync(`convert ${inputPath} -quality 85 ${webpPath}`);
      console.log(`   ✅ ${file} -> ${nameWithoutExt}.webp`);
    } catch (error) {
      console.log(`   ❌ Failed to convert ${file} to WebP`);
    }
    
    // 生成优化后的PNG版本
    const optimizedPngPath = path.join(optimizedDir, `${nameWithoutExt}-optimized.png`);
    try {
      execSync(`convert ${inputPath} -strip -quality 85 ${optimizedPngPath}`);
      console.log(`   ✅ ${file} -> ${nameWithoutExt}-optimized.png`);
    } catch (error) {
      console.log(`   ❌ Failed to optimize ${file}`);
    }
  });
}

// 生成响应式图片HTML
function generateResponsiveImageHTML() {
  const html = `
<!-- 响应式图片组件 -->
<picture>
  <source srcset="/images/icon-192x192.webp" type="image/webp">
  <source srcset="/images/icon-192x192.png" type="image/png">
  <img src="/images/icon-192x192.png" alt="eSIM工具图标" width="192" height="192">
</picture>

<!-- 响应式背景图片 -->
<style>
.responsive-bg {
  background-image: url('/images/background.webp');
  background-image: -webkit-image-set(url('/images/background.webp') 1x, url('/images/background@2x.webp') 2x);
  background-image: image-set(url('/images/background.webp') 1x, url('/images/background@2x.webp') 2x);
}

@media (max-width: 768px) {
  .responsive-bg {
    background-image: url('/images/background-mobile.webp');
  }
}
</style>
  `;
  
  const outputPath = path.join(__dirname, '../src/components/responsive-images.html');
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, html);
  console.log('📄 Responsive image HTML template created');
}

// 生成图片预加载清单
function generateImagePreloadList() {
  const preloadList = [
    '/icons/icon-192x192.webp',
    '/icons/icon-512x512.webp',
    '/images/background.webp'
  ];
  
  const html = preloadList.map(src => 
    `<link rel="preload" href="${src}" as="image" type="image/webp">`
  ).join('\n');
  
  const outputPath = path.join(__dirname, '../src/components/image-preload.html');
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, html);
  console.log('📋 Image preload list created');
}

// 主函数
function main() {
  console.log('🚀 Starting image optimization...\n');
  
  checkDependencies();
  generateIcons();
  optimizeImages();
  generateResponsiveImageHTML();
  generateImagePreloadList();
  
  console.log('\n✅ Image optimization completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Add responsive image components to your HTML');
  console.log('   2. Include image preload tags in your <head>');
  console.log('   3. Test WebP support in different browsers');
}

if (require.main === module) {
  main();
}

module.exports = {
  generateIcons,
  optimizeImages,
  generateResponsiveImageHTML,
  generateImagePreloadList
}; 