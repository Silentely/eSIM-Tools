const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const BuildLogger = require('./logger.js');

const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// 配置
const config = {
  inputDir: path.join(__dirname, '../src/assets/images'),
  outputDir: path.join(__dirname, '../dist/images'),
  maxConcurrent: 4, // Parallel processing limit
  minFileSize: 1024, // Skip files smaller than 1KB
  formats: {
    jpeg: { quality: 80, progressive: true },
    png: { compressionLevel: 9, progressive: true },
    webp: { quality: 80, effort: 6 }
  },
  sizes: {
    thumbnail: { width: 150, height: 150 },
    medium: { width: 800, height: 600 },
    large: { width: 1200, height: 900 }
  }
};

// 确保输出目录存在
function ensureOutputDir() {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
}

// 获取支持的图片格式
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
}

// 优化单个图片
async function optimizeImage(inputPath, outputPath, format, options = {}) {
  try {
    // Check if output already exists and is newer than input
    if (fs.existsSync(outputPath)) {
      const inputStats = await stat(inputPath);
      const outputStats = await stat(outputPath);
      if (outputStats.mtime > inputStats.mtime) {
        BuildLogger.log(`⏭️  跳过已优化: ${path.basename(outputPath)}`);
        return true;
      }
    }

    const image = sharp(inputPath);
    
    // Get image metadata for size validation
    const metadata = await image.metadata();
    
    // Apply format-specific optimizations
    switch (format) {
      case 'jpeg':
        await image
          .jpeg({ 
            quality: options.quality || config.formats.jpeg.quality, 
            progressive: true,
            mozjpeg: true // Use mozjpeg for better compression
          })
          .toFile(outputPath);
        break;
      case 'png':
        await image
          .png({ 
            compressionLevel: 9, 
            progressive: true,
            adaptiveFiltering: true
          })
          .toFile(outputPath);
        break;
      case 'webp':
        await image
          .webp({ 
            quality: options.quality || config.formats.webp.quality, 
            effort: 6,
            smartSubsample: true
          })
          .toFile(outputPath);
        break;
      default:
        await image.toFile(outputPath);
    }
    
    // Calculate compression savings
    const inputSize = (await stat(inputPath)).size;
    const outputSize = (await stat(outputPath)).size;
    const savings = ((inputSize - outputSize) / inputSize * 100).toFixed(1);
    
    BuildLogger.success(' 优化完成: ${path.basename(inputPath)} -> ${format.toUpperCase()} (节省 ${savings}%)');
    return { success: true, inputSize, outputSize, savings };
  } catch (error) {
    console.error(`❌ 优化失败: ${path.basename(inputPath)}`, error.message);
    return { success: false, error: error.message };
  }
}

// 生成多种格式 (with parallel processing)
async function generateMultipleFormats(inputPath, filename) {
  const baseName = path.parse(filename).name;
  
  // Check file size threshold
  const fileStats = await stat(inputPath);
  if (fileStats.size < config.minFileSize) {
    BuildLogger.log(`⏭️  跳过小文件: ${filename} (${fileStats.size} bytes)`);
    return [];
  }
  
  // Generate formats in parallel
  const formatPromises = [];
  
  // Generate JPEG version
  const jpegPath = path.join(config.outputDir, `${baseName}.jpg`);
  formatPromises.push(optimizeImage(inputPath, jpegPath, 'jpeg'));
  
  // Generate WebP version
  const webpPath = path.join(config.outputDir, `${baseName}.webp`);
  formatPromises.push(optimizeImage(inputPath, webpPath, 'webp'));
  
  // Generate PNG version (if original is PNG)
  if (path.extname(filename).toLowerCase() === '.png') {
    const pngPath = path.join(config.outputDir, `${baseName}.png`);
    formatPromises.push(optimizeImage(inputPath, pngPath, 'png'));
  }
  
  const results = await Promise.all(formatPromises);
  return results;
}

// 生成缩略图 (with better error recovery)
async function generateThumbnails(inputPath, filename) {
  const baseName = path.parse(filename).name;
  
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Skip if image is already smaller than thumbnail size
    if (metadata.width <= config.sizes.thumbnail.width && 
        metadata.height <= config.sizes.thumbnail.height) {
      BuildLogger.log(`⏭️  跳过缩略图生成: ${filename} (已足够小)`);
      return { success: true, skipped: true };
    }
    
    // Generate thumbnail
    const thumbnailPath = path.join(config.outputDir, `${baseName}-thumb.jpg`);
    
    // Check if thumbnail already exists and is newer
    if (fs.existsSync(thumbnailPath)) {
      const inputStats = await stat(inputPath);
      const thumbStats = await stat(thumbnailPath);
      if (thumbStats.mtime > inputStats.mtime) {
        BuildLogger.log(`⏭️  跳过已存在的缩略图: ${path.basename(thumbnailPath)}`);
        return { success: true, skipped: true };
      }
    }
    
    await sharp(inputPath)
      .resize(config.sizes.thumbnail.width, config.sizes.thumbnail.height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80, progressive: true })
      .toFile(thumbnailPath);
    
    BuildLogger.success(' 缩略图生成: ${path.basename(thumbnailPath)}');
    return { success: true, skipped: false };
  } catch (error) {
    console.error(`❌ 缩略图生成失败: ${filename}`, error.message);
    return { success: false, error: error.message };
  }
}

// 生成图片清单
function generateManifest() {
  const manifest = {
    generated: new Date().toISOString(),
    images: []
  };
  
  if (fs.existsSync(config.outputDir)) {
    const files = fs.readdirSync(config.outputDir);
    files.forEach(file => {
      if (isImageFile(file)) {
        const stats = fs.statSync(path.join(config.outputDir, file));
        manifest.images.push({
          filename: file,
          size: stats.size,
          format: path.extname(file).toLowerCase().slice(1)
        });
      }
    });
  }
  
  const manifestPath = path.join(config.outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  BuildLogger.log(`📋 图片清单已生成: ${manifestPath}`);
}

// Process images with concurrency control
async function processImagesInBatches(imageFiles) {
  const results = {
    successful: 0,
    failed: 0,
    skipped: 0,
    totalSavings: 0
  };
  
  // Process in batches to avoid memory issues
  for (let i = 0; i < imageFiles.length; i += config.maxConcurrent) {
    const batch = imageFiles.slice(i, i + config.maxConcurrent);
    
    await Promise.all(batch.map(async (filename) => {
      const inputPath = path.join(config.inputDir, filename);
      BuildLogger.log(`\n🔄 处理: ${filename}`);
      
      try {
        // Generate multiple formats
        const formatResults = await generateMultipleFormats(inputPath, filename);
        formatResults.forEach(result => {
          if (result && result.success) {
            results.successful++;
            if (result.savings) {
              results.totalSavings += parseFloat(result.savings);
            }
          } else if (result && !result.success) {
            results.failed++;
          }
        });
        
        // Generate thumbnails
        const thumbnailResult = await generateThumbnails(inputPath, filename);
        if (thumbnailResult.success) {
          if (thumbnailResult.skipped) {
            results.skipped++;
          } else {
            results.successful++;
          }
        } else {
          results.failed++;
        }
      } catch (error) {
        console.error(`❌ 处理失败: ${filename}`, error.message);
        results.failed++;
      }
    }));
  }
  
  return results;
}

// 主函数
async function optimizeImages() {
  BuildLogger.log('🚀 开始图片优化...');
  BuildLogger.log(`📁 输入目录: ${config.inputDir}`);
  BuildLogger.log(`📁 输出目录: ${config.outputDir}`);
  BuildLogger.log(`⚡ 并发数: ${config.maxConcurrent}`);
  
  // 确保输出目录存在
  ensureOutputDir();
  
  // 检查输入目录是否存在
  if (!fs.existsSync(config.inputDir)) {
    BuildLogger.warn('  输入目录不存在，创建示例目录: ${config.inputDir}');
    fs.mkdirSync(config.inputDir, { recursive: true });
    
    // 创建示例文件
    const examplePath = path.join(config.inputDir, 'example.txt');
    fs.writeFileSync(examplePath, '请将需要优化的图片文件放在此目录中');
    BuildLogger.log(`📝 已创建示例文件: ${examplePath}`);
    return;
  }
  
  const files = fs.readdirSync(config.inputDir);
  const imageFiles = files.filter(isImageFile);
  
  if (imageFiles.length === 0) {
    BuildLogger.warn('  未找到图片文件');
    return;
  }
  
  BuildLogger.log(`📸 找到 ${imageFiles.length} 个图片文件`);
  
  const startTime = Date.now();
  const results = await processImagesInBatches(imageFiles);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // 生成清单
  generateManifest();
  
  BuildLogger.log(`\n🎉 优化完成!`);
  BuildLogger.log(`⏱️  用时: ${duration}秒`);
  BuildLogger.success(' 成功: ${results.successful}');
  BuildLogger.log(`⏭️  跳过: ${results.skipped}`);
  BuildLogger.error(' 失败: ${results.failed}');
  if (results.totalSavings > 0) {
    const avgSavings = (results.totalSavings / results.successful).toFixed(1);
    BuildLogger.log(`💾 平均节省空间: ${avgSavings}%`);
  }
  BuildLogger.log(`📁 输出目录: ${config.outputDir}`);
  
  if (results.failed > 0) {
    BuildLogger.warn('  有 ${results.failed} 个文件处理失败');
    process.exit(1);
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  BuildLogger.log(`
📸 图片优化工具 (Sharp版本)

用法: node optimize-images.js [选项]

选项:
  --help, -h     显示帮助信息
  --input <dir>  指定输入目录 (默认: src/assets/images)
  --output <dir> 指定输出目录 (默认: dist/images)
  --quality <n>  设置JPEG/WebP质量 (默认: 80)
  --format <fmt> 指定输出格式 (jpeg, png, webp, all)

示例:
  node optimize-images.js
  node optimize-images.js --input ./images --output ./optimized
  node optimize-images.js --quality 90 --format webp
`);
  process.exit(0);
}

// 处理命令行参数
if (args.includes('--input')) {
  const inputIndex = args.indexOf('--input');
  if (inputIndex + 1 < args.length) {
    config.inputDir = path.resolve(args[inputIndex + 1]);
  }
}

if (args.includes('--output')) {
  const outputIndex = args.indexOf('--output');
  if (outputIndex + 1 < args.length) {
    config.outputDir = path.resolve(args[outputIndex + 1]);
  }
}

if (args.includes('--quality')) {
  const qualityIndex = args.indexOf('--quality');
  if (qualityIndex + 1 < args.length) {
    const quality = parseInt(args[qualityIndex + 1]);
    if (quality >= 1 && quality <= 100) {
      config.formats.jpeg.quality = quality;
      config.formats.webp.quality = quality;
    }
  }
}

// 运行优化
optimizeImages().catch(error => {
  console.error('❌ 程序执行失败:', error);
  process.exit(1);
}); 