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
    const existingScript = document.querySelector(`script[src="${QRCODE_CDN_URL}"]`);
    const script = existingScript || document.createElement('script');

    const handleLoad = () => {
      if (window.QRCode) {
        resolve(window.QRCode);
        return;
      }
      qrCodeLibraryPromise = null;
      reject(new Error('QRCode library loaded but QRCode global is missing'));
    };

    const handleError = () => {
      qrCodeLibraryPromise = null;
      reject(new Error('Failed to load QRCode library from CDN'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      script.src = QRCODE_CDN_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
  });

  return qrCodeLibraryPromise;
}

/**
 * 创建可直接插入页面的二维码 DOM 容器。
 * 使用 img data URL 是为了兼容现有下载逻辑（调用方会 querySelector('img')）。
 * @param {string} imageUrl 二维码图片 data URL
 * @param {number} size 二维码显示尺寸
 * @param {string} [largeImageUrl=imageUrl] tooltip 使用的大图 data URL
 * @returns {{container: HTMLElement, image: HTMLImageElement, tooltip: HTMLElement}}
 */
function createQRCodeContainer(imageUrl, size, largeImageUrl = imageUrl) {
  const container = document.createElement('div');
  container.className = 'qrcode-container';
  container.style.position = 'relative';
  container.style.display = 'inline-block';

  const image = document.createElement('img');
  image.src = imageUrl;
  image.alt = 'eSIM二维码';
  image.className = 'img-fluid';
  image.setAttribute('role', 'img');
  image.setAttribute('aria-label', 'eSIM 安装二维码');
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
  largeImage.alt = 'eSIM二维码放大预览';
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
 * @returns {Promise<{container: HTMLElement, image: HTMLImageElement, tooltip: HTMLElement, source: string}>}
 */
export async function generateQRCodeLocal(data, size = DEFAULT_QR_SIZE) {
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
      ...createQRCodeContainer(imageUrl, safeSize, largeImageUrl),
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
 * @returns {Promise<{container: HTMLElement, image: HTMLImageElement, tooltip: HTMLElement, source: string}>}
 */
export async function generateQRCodeBackend(data, size = DEFAULT_QR_SIZE) {
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
      ...createQRCodeContainer(payload.qrcode, safeSize),
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
 * @returns {Promise<{container: HTMLElement, image: HTMLImageElement, tooltip: HTMLElement, source: string}>}
 */
export async function generateQRCodeWithFallback(data, size = DEFAULT_QR_SIZE) {
  let localError = null;

  try {
    return await generateQRCodeLocal(data, size);
  } catch (error) {
    localError = error;
    console.warn('[QRCode] Local generation failed, trying backend fallback:', error.message);
  }

  try {
    return await generateQRCodeBackend(data, size);
  } catch (backendError) {
    console.error('[QRCode] Backend fallback failed:', backendError.message);
    const finalError = new Error('QR code generation failed after local and backend fallback');
    finalError.localError = localError;
    finalError.backendError = backendError;
    throw finalError;
  }
}
