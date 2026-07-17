'use strict';

import qrcodeLib from './qrcode-lib.js';
import Logger from './logger.js';

const DEFAULT_QR_SIZE = 300;
// 注意：以下校验常量与 netlify/edge-functions/bff-proxy.js 的 QR_MIN_SIZE/QR_MAX_SIZE/QR_MAX_DATA_LENGTH 保持同步
const MIN_QR_SIZE = 200;
const MAX_QR_SIZE = 600;
const MAX_QR_DATA_LENGTH = 2048;
const BACKEND_ENDPOINT = '/bff/qrcode-generate';
const BACKEND_TIMEOUT_MS = 10000;
const QR_MARGIN_MODULES = 8;
const LARGE_PREVIEW_SIZE = 400;

/**
 * QR 码校验错误类。
 * 用于区分校验错误（data/size 不合法）和生成错误（库调用失败），
 * 避免依赖 error.message 字符串前缀做控制流判断。
 */
class QRCodeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QRCodeValidationError';
  }
}

/**
 * 上报二维码生成事件到 Sentry 和 Analytics
 * @param {Object} event - 事件数据
 * @param {string} event.type - 事件类型：'qr_generation' | 'qr_fallback'
 * @param {string} event.source - 生成来源：'local' | 'backend' | 'failed'
 * @param {boolean} event.success - 是否成功
 * @param {number} event.duration - 耗时（毫秒）
 * @param {string} [event.error] - 错误信息
 */
function trackQRCodeEvent({ type, source, success, duration, error }) {
  try {
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) return;

    // 1. 上报到 Sentry（错误事件）
    if (!success && window.Sentry) {
      window.Sentry.captureMessage(`QR Code ${type} failed`, {
        level: 'warning',
        tags: {
          module: 'qrcode-generation',
          source,
          type
        },
        extra: {
          duration,
          error
        }
      });
    }

    // 2. 上报到 Analytics（成功和失败都上报）
    window.__esimAnalytics = window.__esimAnalytics || [];
    window.__esimAnalytics.push({
      event: type,
      source,
      success,
      duration,
      error: error || null
    });

    // 3. 控制台日志（开发调试）
    if (!success) {
      Logger.warn(`[QRCode Analytics] ${type}: source=${source}, duration=${duration}ms, error=${error}`);
    }
  } catch (err) {
    // 监控上报不应影响正常功能
    Logger.debug('[QRCode Analytics] track failed:', err.message);
  }
}

/**
 * 标准化二维码尺寸，避免生成过大图片拖慢页面。
 * @param {number} [size=300] 二维码尺寸，单位 px
 * @returns {number} 安全的二维码尺寸
 * @throws {QRCodeValidationError} 尺寸不合法时抛出
 */
function normalizeQRCodeSize(size = DEFAULT_QR_SIZE) {
  const normalizedSize = Number(size);

  if (!Number.isInteger(normalizedSize)) {
    throw new QRCodeValidationError('QR code size must be an integer');
  }

  if (normalizedSize < MIN_QR_SIZE || normalizedSize > MAX_QR_SIZE) {
    throw new QRCodeValidationError(`QR code size must be between ${MIN_QR_SIZE} and ${MAX_QR_SIZE}`);
  }

  return normalizedSize;
}

/**
 * 校验二维码内容，防止空值和异常大 payload 进入生成流程。
 * @param {string} data 二维码内容
 * @returns {string} 校验后的二维码内容
 * @throws {QRCodeValidationError} 内容不合法时抛出
 */
function validateQRCodeData(data) {
  if (typeof data !== 'string') {
    throw new QRCodeValidationError('QR code data must be a string');
  }

  if (data.length < 1 || data.length > MAX_QR_DATA_LENGTH) {
    throw new QRCodeValidationError(`QR code data length must be between 1 and ${MAX_QR_DATA_LENGTH}`);
  }

  return data;
}

/**
 * 获取本地打包的 QRCode 库实例。
 * 库已内联到项目中，无需网络请求。
 * @returns {Object} qrcode 工厂函数
 * @throws {Error} 库未正确加载时抛出
 */
function getQRCodeLibrary() {
  if (typeof qrcodeLib === 'function') {
    return qrcodeLib;
  }
  // 降级：检查全局变量（兼容极端情况）
  if (typeof window !== 'undefined' && typeof window.qrcode === 'function') {
    return window.qrcode;
  }
  throw new Error('QRCode library not available');
}

/**
 * 创建可直接插入页面的二维码 DOM 容器。
 * 使用 img data URL 是为了兼容现有下载逻辑（调用方会 querySelector('img')）。
 * @param {string} imageUrl 二维码图片 data URL
 * @param {number} size 二维码显示尺寸
 * @param {string} [largeImageUrl=imageUrl] tooltip 使用的大图 data URL
 * @param {Object} [labels={}] 可访问性标签（支持 i18n）
 * @param {string} [labels.alt='eSIM QR Code'] 图片 alt 文本
 * @param {string} [labels.ariaLabel='eSIM Installation QR Code'] 图片 aria-label
 * @param {string} [labels.tooltipAlt='eSIM QR Code Preview'] tooltip 大图 alt 文本
 * @returns {{container: HTMLElement, image: HTMLImageElement, tooltip: HTMLElement}}
 */
function createQRCodeContainer(imageUrl, size, largeImageUrl = imageUrl, labels = {}) {
  const {
    alt = 'eSIM QR Code',
    ariaLabel = 'eSIM Installation QR Code',
    tooltipAlt = 'eSIM QR Code Preview'
  } = labels;

  const container = document.createElement('div');
  container.className = 'qrcode-container';
  container.style.position = 'relative';
  container.style.display = 'inline-block';

  const image = document.createElement('img');
  image.src = imageUrl;
  image.alt = alt;
  image.className = 'img-fluid';
  image.setAttribute('role', 'img');
  image.setAttribute('aria-label', ariaLabel);
  image.setAttribute('loading', 'lazy');
  image.style.border = '5px solid white';
  image.style.borderRadius = '12px';
  image.style.maxWidth = `${size}px`;

  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.style.padding = '0';
  tooltip.style.background = 'none';
  tooltip.style.boxShadow = 'none';
  tooltip.style.willChange = 'transform';
  tooltip.setAttribute('aria-hidden', 'true');

  const largeImage = document.createElement('img');
  largeImage.src = largeImageUrl;
  largeImage.alt = tooltipAlt;
  largeImage.style.width = '400px';
  largeImage.style.height = '400px';
  tooltip.appendChild(largeImage);

  container.appendChild(image);
  container.appendChild(tooltip);

  return { container, image, tooltip };
}

/**
 * 使用浏览器本地 qrcode.js 生成二维码。
 * 注意：函数体内无 await（getQRCodeLibrary 已是同步调用），保留 async 是为了
 * 兼容调用方的 await 签名以及未来可能恢复异步加载（如 WebAssembly 版 QR 库）。
 * @param {string} data 二维码内容
 * @param {number} [size=300] 二维码尺寸
 * @param {Object} [labels={}] 可访问性标签（支持 i18n）
 * @returns {Promise<{container: HTMLElement, image: HTMLImageElement, tooltip: HTMLElement, source: string}>}
 */
export async function generateQRCodeLocal(data, size = DEFAULT_QR_SIZE, labels = {}) {
  try {
    const safeData = validateQRCodeData(data);
    const safeSize = normalizeQRCodeSize(size);
    const qrCodeLib = getQRCodeLibrary();

    // qrcode-generator 包的 API 与 qrcode 包不同
    // 正确用法：qrcode(typeNumber, errorCorrectionLevel).addData(data).make().createDataURL(cellSize, margin)
    // typeNumber 0 = 自动检测，errorCorrectionLevel: L/M/Q/H
    const qr = qrCodeLib(0, 'M');  // 0 = auto type number, M = medium error correction
    qr.addData(safeData);
    qr.make();

    // cellSize 计算：根据目标尺寸和 QR 码模块数计算
    // qr.getModuleCount() 返回 QR 码的模块数（行/列数）
    const moduleCount = qr.getModuleCount();
    const cellSize = Math.max(1, Math.floor(safeSize / (moduleCount + QR_MARGIN_MODULES)));
    const largeCellSize = Math.max(1, Math.floor(LARGE_PREVIEW_SIZE / (moduleCount + QR_MARGIN_MODULES)));

    const imageUrl = qr.createDataURL(cellSize, cellSize * 4);
    const largeImageUrl = qr.createDataURL(largeCellSize, largeCellSize * 4);

    Logger.log(`[QRCode] Local generation success: size=${safeSize}, modules=${moduleCount}, cellSize=${cellSize}`);

    return {
      ...createQRCodeContainer(imageUrl, safeSize, largeImageUrl, labels),
      source: 'local'
    };
  } catch (error) {
    // qrcode-generator 库可能 throw 字符串而非 Error 对象，统一转换
    const err = error instanceof Error ? error : new Error(String(error));

    // 校验错误直接抛出，不包装为生成错误
    if (err instanceof QRCodeValidationError) {
      throw err;
    }
    throw new Error(`Local QR code generation failed: ${err.message}`);
  }
}

/**
 * 调用后端 Edge Function 生成二维码，作为浏览器本地生成失败时的降级方案。
 * 注意：此路径仅在 Netlify 部署环境中可用（Edge Function）。
 * 本地开发环境（server.js）不代理此端点，降级路径会返回 404。
 * @param {string} data 二维码内容
 * @param {number} [size=300] 二维码尺寸
 * @param {Object} [labels={}] 可访问性标签（支持 i18n）
 * @returns {Promise<{container: HTMLElement, image: HTMLImageElement, tooltip: HTMLElement, source: string}>}
 */
export async function generateQRCodeBackend(data, size = DEFAULT_QR_SIZE, labels = {}) {
  const safeData = validateQRCodeData(data);
  const safeSize = normalizeQRCodeSize(size);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const response = await fetch(BACKEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: safeData, size: safeSize }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Backend QR code endpoint returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!(payload && payload.success) || typeof payload.qrcode !== 'string') {
      throw new Error((payload && payload.error) || 'Backend QR code response is invalid');
    }

    Logger.log(`[QRCode] Backend generation success: size=${safeSize}, qrcodeLength=${payload.qrcode.length}`);

    return {
      ...createQRCodeContainer(payload.qrcode, safeSize, payload.qrcode, labels),
      source: 'backend'
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Backend QR code generation timed out after ${BACKEND_TIMEOUT_MS}ms`);
    }
    throw new Error(`Backend QR code generation failed: ${error.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 三层降级二维码生成：本地生成 → 后端生成 → 抛错由调用方显示 LPA 手动安装提示。
 * @param {string} data 二维码内容
 * @param {number} [size=300] 二维码尺寸
 * @param {Object} [labels={}] 可访问性标签（支持 i18n）
 * @returns {Promise<{container: HTMLElement, image: HTMLImageElement, tooltip: HTMLElement, source: string}>}
 */
export async function generateQRCodeWithFallback(data, size = DEFAULT_QR_SIZE, labels = {}) {
  const startTime = Date.now();
  let localError = null;

  // 校验错误直接抛出，不走降级路径
  validateQRCodeData(data);
  normalizeQRCodeSize(size);

  // 尝试本地生成
  try {
    const result = await generateQRCodeLocal(data, size, labels);
    const duration = Date.now() - startTime;

    trackQRCodeEvent({
      type: 'qr_generation',
      source: 'local',
      success: true,
      duration
    });

    return result;
  } catch (error) {
    localError = error;
    Logger.warn('[QRCode] Local generation failed, trying backend fallback:', error.message);

    trackQRCodeEvent({
      type: 'qr_fallback',
      source: 'local',
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    });
  }

  // 本地失败，尝试后端降级
  try {
    const result = await generateQRCodeBackend(data, size, labels);
    const duration = Date.now() - startTime;

    trackQRCodeEvent({
      type: 'qr_generation',
      source: 'backend',
      success: true,
      duration
    });

    return result;
  } catch (backendError) {
    const duration = Date.now() - startTime;

    Logger.error('[QRCode] Backend fallback failed:', backendError.message);

    trackQRCodeEvent({
      type: 'qr_generation',
      source: 'failed',
      success: false,
      duration,
      error: backendError.message
    });

    const finalError = new Error('QR code generation failed after local and backend fallback');
    finalError.localError = localError;
    finalError.backendError = backendError;
    throw finalError;
  }
}
