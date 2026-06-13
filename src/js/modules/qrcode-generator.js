'use strict';

const QRCODE_CDN_URL = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
const DEFAULT_QR_SIZE = 300;
const MIN_QR_SIZE = 200;
const MAX_QR_SIZE = 600;
const MAX_QR_DATA_LENGTH = 2048;
const BACKEND_ENDPOINT = '/bff/qrcode-generate';
const BACKEND_TIMEOUT_MS = 10000;

let qrCodeLibraryPromise = null;

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
    // 1. 上报到 Sentry（错误事件）
    if (!success && typeof window !== 'undefined' && window.Sentry) {
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
    if (typeof window !== 'undefined') {
      window.__esimAnalytics = window.__esimAnalytics || [];
      window.__esimAnalytics.push({
        event: type,
        source,
        success,
        duration,
        error: error || null
      });
    }

    // 3. 控制台日志（开发调试）
    if (!success) {
      console.warn(`[QRCode Analytics] ${type}: source=${source}, duration=${duration}ms, error=${error}`);
    }
  } catch (err) {
    // 监控上报不应影响正常功能
    console.debug('[QRCode Analytics] track failed:', err.message);
  }
}

/**
 * 标准化二维码尺寸，避免生成过大图片拖慢页面。
 * @param {number} [size=300] 二维码尺寸，单位 px
 * @returns {number} 安全的二维码尺寸
 * @throws {Error} 尺寸不合法时抛出
 */
function normalizeQRCodeSize(size = DEFAULT_QR_SIZE) {
  const normalizedSize = Number(size);

  if (!Number.isInteger(normalizedSize)) {
    throw new Error('QR code size must be an integer');
  }

  if (normalizedSize < MIN_QR_SIZE || normalizedSize > MAX_QR_SIZE) {
    throw new Error(`QR code size must be between ${MIN_QR_SIZE} and ${MAX_QR_SIZE}`);
  }

  return normalizedSize;
}

/**
 * 校验二维码内容，防止空值和异常大 payload 进入生成流程。
 * @param {string} data 二维码内容
 * @returns {string} 校验后的二维码内容
 * @throws {Error} 内容不合法时抛出
 */
function validateQRCodeData(data) {
  if (typeof data !== 'string') {
    throw new Error('QR code data must be a string');
  }

  if (data.length < 1 || data.length > MAX_QR_DATA_LENGTH) {
    throw new Error(`QR code data length must be between 1 and ${MAX_QR_DATA_LENGTH}`);
  }

  return data;
}

/**
 * 懒加载浏览器端 qrcode.js 库。
 * 首次调用会插入 CDN script，后续调用复用同一个 Promise，避免重复加载。
 * 修复 Promise 挂起问题：移除失效脚本、添加超时保护（Issue #75 根因修复）。
 * @returns {Promise<Object>} qrcode.js 暴露的 QRCode 对象
 */
export async function loadQRCodeLibrary() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('QRCode local generation requires a browser environment');
  }

  if (window.QRCode) {
    return window.QRCode;
  }

  if (qrCodeLibraryPromise) {
    return qrCodeLibraryPromise;
  }

  qrCodeLibraryPromise = new Promise((resolve, reject) => {
    const LOAD_TIMEOUT_MS = 5000;
    let timeoutId = null;

    const existingScript = document.querySelector(`script[src="${QRCODE_CDN_URL}"]`);

    // 如果脚本已存在且 window.QRCode 已加载，直接返回
    if (existingScript && window.QRCode) {
      resolve(window.QRCode);
      return;
    }

    // 如果脚本已存在但 window.QRCode 未加载（说明脚本已失效），移除并重新加载
    if (existingScript) {
      console.warn('[QRCode] Existing script found but QRCode global is missing, removing stale script');
      existingScript.remove();
    }

    // 创建新的脚本元素
    const script = document.createElement('script');

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    const handleLoad = () => {
      cleanup();
      if (window.QRCode) {
        resolve(window.QRCode);
        return;
      }
      // 脚本加载成功但 window.QRCode 不存在（CDN 内容异常）
      qrCodeLibraryPromise = null;
      script.remove();
      reject(new Error('QRCode library loaded but QRCode global is missing'));
    };

    const handleError = () => {
      cleanup();
      qrCodeLibraryPromise = null;
      script.remove();
      reject(new Error('Failed to load QRCode library from CDN'));
    };

    const handleTimeout = () => {
      cleanup();
      qrCodeLibraryPromise = null;
      script.remove();
      reject(new Error(`QRCode library loading timed out after ${LOAD_TIMEOUT_MS}ms`));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    // 添加超时保护，防止 Promise 永久挂起
    timeoutId = setTimeout(handleTimeout, LOAD_TIMEOUT_MS);

    script.src = QRCODE_CDN_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  });

  return qrCodeLibraryPromise;
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
 * @param {string} data 二维码内容
 * @param {number} [size=300] 二维码尺寸
 * @param {Object} [labels={}] 可访问性标签（支持 i18n）
 * @returns {Promise<{container: HTMLElement, image: HTMLImageElement, tooltip: HTMLElement, source: string}>}
 */
export async function generateQRCodeLocal(data, size = DEFAULT_QR_SIZE, labels = {}) {
  try {
    const safeData = validateQRCodeData(data);
    const safeSize = normalizeQRCodeSize(size);
    const qrCode = await loadQRCodeLibrary();

    const imageUrl = await qrCode.toDataURL(safeData, {
      errorCorrectionLevel: 'M',
      margin: 2,
      type: 'image/png',
      width: safeSize
    });

    const largeImageUrl = await qrCode.toDataURL(safeData, {
      errorCorrectionLevel: 'M',
      margin: 2,
      type: 'image/png',
      width: 400
    });

    return {
      ...createQRCodeContainer(imageUrl, safeSize, largeImageUrl, labels),
      source: 'local'
    };
  } catch (error) {
    throw new Error(`Local QR code generation failed: ${error.message}`);
  }
}

/**
 * 调用后端 Function 生成二维码，作为浏览器本地生成失败时的降级方案。
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
    if (!payload?.success || typeof payload.qrcode !== 'string') {
      throw new Error(payload?.error || 'Backend QR code response is invalid');
    }

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
    console.warn('[QRCode] Local generation failed, trying backend fallback:', error.message);

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

    console.error('[QRCode] Backend fallback failed:', backendError.message);

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
