/**
 * Netlify Edge Function: BFF Proxy
 * - 接收前端对 /bff/* 的请求
 * - 在服务端附加 x-esim-key（来自环境变量 ACCESS_KEY）
 * - 仅转发显式允许的 /.netlify/functions/* 目标
 * - QR 码生成直接在 Edge Function 中处理（无冷启动延迟）
 */

import qrCodeLib from './qrcode-lib.js';

const BFF_ROUTES = new Map([
  ['giffgaff-token-exchange', ['POST', 'OPTIONS']],
  ['giffgaff-graphql', ['POST', 'OPTIONS']],
  ['giffgaff-mfa-challenge', ['POST', 'OPTIONS']],
  ['giffgaff-mfa-validation', ['POST', 'OPTIONS']],
  ['giffgaff-sms-activate', ['POST', 'OPTIONS']],
  ['auto-activate-esim', ['POST', 'OPTIONS']],
  ['qrcode-generate', ['POST', 'OPTIONS']],
  ['verify-cookie', ['POST', 'OPTIONS']],
  ['public-config', ['GET', 'OPTIONS']],
  ['health', ['GET', 'OPTIONS']]
]);

// QR 码生成参数校验常量
const QR_MIN_SIZE = 200;
const QR_MAX_SIZE = 600;
const QR_MAX_DATA_LENGTH = 2048;

// 注意：此文件运行在 Deno（Edge Function），无法直接引用 Node.js 的 _shared/cors.js。
// 下方 parseAllowedOrigins 逻辑需与 netlify/functions/_shared/cors.js 的 parseOrigins 保持同步。
const DEFAULT_ALLOWED_ORIGIN = 'https://esim.cosr.eu.org';

function getEnv(name, fallback = '') {
  return (typeof Deno !== 'undefined' && Deno.env && Deno.env.get(name)) || fallback;
}

function parseAllowedOrigins(raw) {
  return String(raw || DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

function buildCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MFA-Signature, X-MFA-Ref, X-MFA-Challenge-Ref, X-CF-Turnstile',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin'
  };
}

export default async (request, context) => {
  const url = new URL(request.url);
  const ts = new Date().toISOString();

  // 仅处理 /bff/* 路径
  if (!url.pathname.startsWith('/bff/')) {
    return new Response('Not Found', { status: 404 });
  }

  const targetName = url.pathname.replace(/^\/bff\//, '');
  if (!targetName || !/^[a-z0-9-]+$/.test(targetName)) {
    return jsonResponse(400, { error: 'Bad Request', message: 'Invalid BFF target' });
  }

  const allowedMethods = BFF_ROUTES.get(targetName);
  if (!allowedMethods) {
    console.warn(`[BFF] ${ts} | blocked unknown target=${targetName}`);
    return jsonResponse(404, { error: 'Not Found', message: 'BFF target not allowed' });
  }

  if (!allowedMethods.includes(request.method)) {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  const allowedOrigins = parseAllowedOrigins(getEnv('ALLOWED_ORIGIN'));
  const requestOrigin = request.headers.get('origin') || '';
  const sameOrigin = requestOrigin === url.origin;
  const configuredOrigin = allowedOrigins.includes(requestOrigin);
  const corsOrigin = sameOrigin || configuredOrigin ? requestOrigin : '';
  const allowMissingOriginForPublicGet = (targetName === 'public-config' || targetName === 'health') && request.method === 'GET';
  const fallbackCorsOrigin = allowedOrigins[0] || DEFAULT_ALLOWED_ORIGIN;
  const errorCorsHeaders = buildCorsHeaders(corsOrigin || fallbackCorsOrigin);

  if (!corsOrigin && !allowMissingOriginForPublicGet) {
    console.warn(`[BFF] ${ts} | blocked origin=${requestOrigin || 'missing'} target=${targetName}`);
    return jsonResponse(403, { error: 'Forbidden', message: 'Origin not allowed' }, errorCorsHeaders);
  }

  const corsHeaders = corsOrigin ? buildCorsHeaders(corsOrigin) : {};
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  console.log(`[BFF] ${ts} | ${request.method} ${url.pathname} → target=${targetName}`);

  // === QR 码生成：Edge Function 直接处理（无冷启动） ===
  if (targetName === 'qrcode-generate') {
    const qrStartTime = Date.now();

    if (request.method !== 'POST') {
      console.log(`[edge:qrcode-generate] Method not allowed: ${request.method}`);
      return jsonResponse(405, { error: 'Method Not Allowed' }, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      console.warn('[edge:qrcode-generate] Invalid JSON body');
      return jsonResponse(400, { error: 'Invalid JSON body' }, corsHeaders);
    }

    const { data, size = 300 } = body;

    // 参数校验（不记录 data 内容，避免 LPA 激活信息泄露）
    if (typeof data !== 'string' || data.length < 1 || data.length > QR_MAX_DATA_LENGTH) {
      console.warn(`[edge:qrcode-generate] Invalid data: type=${typeof data}, length=${data ? data.length : 0}`);
      return jsonResponse(400, {
        error: `data must be a string between 1 and ${QR_MAX_DATA_LENGTH} characters`
      }, corsHeaders);
    }

    const numSize = Number(size);
    if (!Number.isInteger(numSize) || numSize < QR_MIN_SIZE || numSize > QR_MAX_SIZE) {
      console.warn(`[edge:qrcode-generate] Invalid size: ${size}`);
      return jsonResponse(400, {
        error: `size must be an integer between ${QR_MIN_SIZE} and ${QR_MAX_SIZE}`
      }, corsHeaders);
    }

    // 生成 QR 码（纯 CPU 操作，< 10ms）
    try {
      const qr = qrCodeLib(0, 'M');
      qr.addData(data);
      qr.make();
      const moduleCount = qr.getModuleCount();
      const cellSize = Math.max(1, Math.floor(numSize / (moduleCount + 8)));
      const qrcode = qr.createDataURL(cellSize, 2);

      const duration = Date.now() - qrStartTime;
      console.log(`[edge:qrcode-generate] Success: size=${numSize}, modules=${moduleCount}, cellSize=${cellSize}, duration=${duration}ms, qrcodeLength=${qrcode.length}`);

      return jsonResponse(200, { success: true, qrcode }, corsHeaders);
    } catch (error) {
      const duration = Date.now() - qrStartTime;
      console.error(`[edge:qrcode-generate] Failed: error=${error.message}, duration=${duration}ms`);
      return jsonResponse(500, { error: error.message }, corsHeaders);
    }
  }

  // 目标 Netlify Function URL（同域）
  const functionUrl = new URL(`/.netlify/functions/${targetName}` , request.url);

  // 从 Edge 运行时环境读取密钥
  // Netlify Edge 使用 Deno 运行时
  const accessKey = getEnv('ACCESS_KEY');
  if (!accessKey) {
    console.error(`[BFF] ${ts} | ACCESS_KEY missing in Edge env`);
    return jsonResponse(500, { error: 'Server Misconfigured', message: 'ACCESS_KEY not configured' }, corsHeaders);
  }
  console.log(`[BFF] ${ts} | ACCESS_KEY present, proceeding`);

  // 复制请求头并添加服务端密钥头；客户端提供的内部密钥一律不透传。
  const headers = new Headers(request.headers);
  headers.delete('x-app-key');
  headers.set('x-esim-key', accessKey);

  // 复制请求体
  let body = undefined;
  const isMutating = request.method !== 'GET' && request.method !== 'HEAD';
  if (isMutating) {
    try {
      body = await request.arrayBuffer();
      console.log(`[BFF] ${ts} | body read OK, size=${body.byteLength} bytes`);
    } catch (bodyErr) {
      console.error(`[BFF] ${ts} | body read FAILED: ${bodyErr.message}`);
      return jsonResponse(400, { error: 'Bad Request', message: 'Failed to read request body' }, corsHeaders);
    }
  }

  const proxiedRequest = new Request(functionUrl.toString(), {
    method: request.method,
    headers,
    body
  });

  console.log(`[BFF] ${ts} | forwarding to ${functionUrl.pathname}`);
  let response;
  try {
    response = await fetch(proxiedRequest);
  } catch (fetchErr) {
    console.error(`[BFF] ${ts} | fetch to Function FAILED: ${fetchErr.message}`);
    return jsonResponse(502, { error: 'Bad Gateway', message: 'Failed to reach upstream function' }, corsHeaders);
  }

  // 响应日志（不包含敏感信息）
  console.log(`[BFF] ${ts} | response from ${functionUrl.pathname}: status=${response.status} ok=${response.ok}`);

  const responseHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
};
