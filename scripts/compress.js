const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const BuildLogger = require('./logger.js');

const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

// 压缩配置
const compressionOptions = {
  gzip: {
    level: 9,
    memLevel: 9
  },
  brotli: {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 0
    }
  }
};

// 需要压缩的文件类型
const compressibleExtensions = ['.js', '.css', '.html', '.json', '.xml', '.svg'];

// 最小压缩文件大小 (1KB)
const MIN_COMPRESS_SIZE = 1024;

// 缓存已压缩文件的元数据
const compressionCache = new Map();

// 压缩单个文件
async function compressFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    
    // 只压缩特定类型的文件
    if (!compressibleExtensions.includes(ext)) {
      return null;
    }
    
    // Skip small files (compression not worth it)
    if (content.length < MIN_COMPRESS_SIZE) {
      return null;
    }
    
    const fileName = path.basename(filePath);
    const dir = path.dirname(filePath);
    const fileStat = fs.statSync(filePath);
    
    // Check cache - skip if already compressed and source hasn't changed
    const cacheKey = filePath;
    if (compressionCache.has(cacheKey)) {
      const cached = compressionCache.get(cacheKey);
      if (cached.mtime >= fileStat.mtimeMs) {
        return null; // Already compressed
      }
    }
    
    // Gzip压缩
    const gzipPath = path.join(dir, `${fileName}.gz`);
    const gzipped = await gzip(content, compressionOptions.gzip);
    
    // Only write if compression achieved meaningful reduction
    const compressionRatio = (content.length - gzipped.length) / content.length;
    if (compressionRatio > 0.1) { // At least 10% reduction
      fs.writeFileSync(gzipPath, gzipped);
    } else {
      return null; // Skip if compression is not effective
    }
    
    // Brotli压缩（如果支持）
    let brotliSize = 0;
    try {
      const brotlied = await brotliCompress(content, compressionOptions.brotli);
      const brotliPath = path.join(dir, `${fileName}.br`);
      
      // Only write if brotli is smaller than gzip
      if (brotlied.length < gzipped.length) {
        fs.writeFileSync(brotliPath, brotlied);
        brotliSize = brotlied.length;
      }
    } catch (error) {
      BuildLogger.log(`Brotli压缩失败 ${fileName}:`, error.message);
    }
    
    const originalSize = content.length;
    const gzipSize = gzipped.length;
    const compressionRatioPercent = (compressionRatio * 100).toFixed(1);
    
    // Update cache
    compressionCache.set(cacheKey, { mtime: fileStat.mtimeMs });
    
    return {
      file: fileName,
      original: originalSize,
      gzip: gzipSize,
      brotli: brotliSize,
      ratio: compressionRatioPercent
    };
  } catch (error) {
    console.error(`压缩文件失败 ${filePath}:`, error.message);
    return null;
  }
}

// 递归压缩目录
async function compressDirectory(dirPath) {
  const results = [];
  
  async function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (stat.isFile()) {
        const result = await compressFile(fullPath);
        if (result) {
          results.push(result);
        }
      }
    }
  }
  
  await scanDirectory(dirPath);
  return results;
}

// 主压缩函数
async function compressBuild() {
  const distDir = path.join(__dirname, '../dist');
  
  if (!fs.existsSync(distDir)) {
    console.error('dist目录不存在，请先运行构建命令');
    return;
  }
  
  BuildLogger.log('开始压缩构建文件...');
  
  try {
    const results = await compressDirectory(distDir);
    
    if (results.length === 0) {
      BuildLogger.log('没有找到需要压缩的文件');
      return;
    }
    
    // 显示压缩结果
    BuildLogger.log('\n压缩结果:');
    BuildLogger.log('文件名'.padEnd(30) + '原始大小'.padEnd(12) + 'Gzip大小'.padEnd(12) + 'Brotli大小'.padEnd(12) + '压缩率');
    BuildLogger.log('-'.repeat(80));
    
    let totalOriginal = 0;
    let totalGzip = 0;
    let totalBrotli = 0;
    
    results.forEach(result => {
      totalOriginal += result.original;
      totalGzip += result.gzip;
      if (result.brotli) totalBrotli += result.brotli;
      
      const originalKB = (result.original / 1024).toFixed(1);
      const gzipKB = (result.gzip / 1024).toFixed(1);
      const brotliKB = result.brotli ? (result.brotli / 1024).toFixed(1) : '-';
      
      BuildLogger.log(
        result.file.padEnd(30) +
        `${originalKB}KB`.padEnd(12) +
        `${gzipKB}KB`.padEnd(12) +
        `${brotliKB}KB`.padEnd(12) +
        `${result.ratio}%`
      );
    });
    
    const totalRatio = ((totalOriginal - totalGzip) / totalOriginal * 100).toFixed(1);
    BuildLogger.log('-'.repeat(80));
    BuildLogger.log(
      '总计'.padEnd(30) +
      `${(totalOriginal / 1024).toFixed(1)}KB`.padEnd(12) +
      `${(totalGzip / 1024).toFixed(1)}KB`.padEnd(12) +
      `${totalBrotli > 0 ? (totalBrotli / 1024).toFixed(1) + 'KB' : '-'}`.padEnd(12) +
      `${totalRatio}%`
    );
    
    BuildLogger.log(`\n压缩完成！共处理 ${results.length} 个文件`);
    BuildLogger.log(`节省空间: ${((totalOriginal - totalGzip) / 1024).toFixed(1)}KB`);
  } catch (error) {
    console.error('压缩失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  compressBuild();
}

module.exports = { compressBuild, compressFile }; 