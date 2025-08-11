/**
 * Netlify Edge Function: BFF Proxy
 * - 接收前端对 /bff/* 的请求
 * - 在服务端附加 x-esim-key（来自环境变量 ACCESS_KEY 或 ESIM_ACCESS_KEY）
 * - 转发到对应的 /.netlify/functions/* 目标
 */

export default async (request, context) => {
  const url = new URL(request.url);

  // 仅处理 /bff/* 路径
  if (!url.pathname.startsWith('/bff/')) {
    return new Response('Not Found', { status: 404 });
  }

  const targetName = url.pathname.replace(/^\/bff\//, '');
  if (!targetName) {
    return new Response('Bad Request', { status: 400 });
  }

  // 目标 Netlify Function URL（同域）
  const functionUrl = new URL(`/.netlify/functions/${targetName}` , request.url);

  // 从 Edge 运行时环境读取密钥
  // Netlify Edge 使用 Deno 运行时
  const accessKey = (typeof Deno !== 'undefined' && Deno.env && (Deno.env.get('ACCESS_KEY') || Deno.env.get('ESIM_ACCESS_KEY'))) || '';

  // 复制请求头并添加服务端密钥头（仅内部互调使用，不影响浏览器 CORS）
  const headers = new Headers(request.headers);
  if (accessKey) {
    headers.set('x-esim-key', accessKey);
  }
  // 不强制设置 Origin；Functions 对无 Origin 的服务端调用放行

  // 复制请求体（仅在需要时读取）
  let body = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const buf = await request.arrayBuffer();
    body = buf;
  }

  const proxiedRequest = new Request(functionUrl.toString(), {
    method: request.method,
    headers,
    body
  });

  const response = await fetch(proxiedRequest);

  // 直接透传响应
  return response;
};


