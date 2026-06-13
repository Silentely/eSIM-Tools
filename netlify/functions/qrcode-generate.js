'use strict';

const QRCode = require('qrcode');
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');

const DEFAULT_QR_SIZE = 300;
const MIN_QR_SIZE = 200;
const MAX_QR_SIZE = 600;
const QR_TIMEOUT_MS = 10000;

const qrcodeSchema = {
  data: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 2048
  },
  size: {
    required: false,
    type: 'number'
  }
};

function normalizeSize(size = DEFAULT_QR_SIZE) {
  const normalizedSize = Number(size);

  if (!Number.isInteger(normalizedSize)) {
    throw new AuthError('size must be an integer', 400);
  }

  if (normalizedSize < MIN_QR_SIZE || normalizedSize > MAX_QR_SIZE) {
    throw new AuthError(`size must be between ${MIN_QR_SIZE} and ${MAX_QR_SIZE}`, 400);
  }

  return normalizedSize;
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`QR code generation timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

exports.handler = withAuth(async (event, context, { body }) => {
  // 405 优先于 Schema 验证（确保 HTTP 方法错误优先返回）
  if (event.httpMethod !== 'POST') {
    throw new AuthError('Method Not Allowed', 405);
  }

  // 手动调用 Schema 验证，确保 405 已经检查过
  validateInput(qrcodeSchema, body);

  const size = normalizeSize(body.size);

  try {
    const qrcode = await withTimeout(QRCode.toDataURL(body.data, {
      errorCorrectionLevel: 'M',
      margin: 2,
      type: 'image/png',
      width: size
    }), QR_TIMEOUT_MS);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        qrcode
      })
    };
  } catch (error) {
    // 不记录 data，避免 LPA 激活信息进入日志或 Sentry。
    console.error('[qrcode-generate] QR code generation failed:', error.message);

    // 创建一个不含敏感数据的错误对象，防止 LPA 字符串通过 Sentry 泄露
    const sanitizedError = new Error(error.message);
    sanitizedError.name = error.name;
    sanitizedError.stack = error.stack;
    // 不复制可能包含 body.data 的属性
    throw sanitizedError;
  }
}, { requireAuth: true });
