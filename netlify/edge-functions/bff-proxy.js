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
  if (!accessKey) {
    return new Response(JSON.stringify({ error: 'Server Misconfigured', message: 'ACCESS_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Turnstile 校验（可选，若配置了 TURNSTILE_SECRET_KEY 则启用）
  const turnstileSecret = (typeof Deno !== 'undefined' && Deno.env && Deno.env.get('TURNSTILE_SECRET_KEY')) || '';
  if (turnstileSecret) {
    try {
      // 读取前端传来的 token（body 或 header）
      let cfToken = request.headers.get('x-cf-turnstile') || '';
      if (!cfToken && request.method !== 'GET' && request.method !== 'HEAD') {
        const clone = request.clone();
        const contentType = clone.headers.get('content-type') || '';
        if (/application\/json/i.test(contentType)) {
          const j = await clone.json().catch(() => null);
          if (j && j.turnstileToken) cfToken = j.turnstileToken;
        } else if (/application\/x-www-form-urlencoded/i.test(contentType)) {
          const t = await clone.text();
          const u = new URLSearchParams(t);
          cfToken = u.get('turnstileToken') || '';
        }
      }

      // 放宽：某些无状态首次请求允许放行（比如仅获取 OAuth 链接时不需要）
      // 对涉及账户/预订/激活等写操作必须要求 token
      const mustRequire = /giffgaff-token-exchange|giffgaff-mfa-|giffgaff-graphql|verify-cookie|auto-activate-esim|giffgaff-sms-activate/i.test(targetName);
      if (mustRequire && !cfToken) {
        return new Response(JSON.stringify({ error: 'Turnstile Required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }

      // 调用 Cloudflare 校验接口
      if (mustRequire) {
        const verifyResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: turnstileSecret, response: cfToken })
        });
        const verifyData = await verifyResp.json();
        if (!verifyData.success) {
          return new Response(JSON.stringify({ error: 'Turnstile Failed', details: verifyData }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
      }
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Turnstile Check Error' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // 复制请求头并添加服务端密钥头（仅内部互调使用，不影响浏览器 CORS）
  const headers = new Headers(request.headers);
  if (accessKey) {
    headers.set('x-esim-key', accessKey);
  }
  // 不强制设置 Origin；Functions 对无 Origin 的服务端调用放行

  // 复制请求体（在 Turnstile 校验过程中读取一次并复用）
  let body = undefined;
  let parsedJson = null;
  let parsedForm = null;
  const isMutating = request.method !== 'GET' && request.method !== 'HEAD';
  if (isMutating) {
    const buf = await request.arrayBuffer();
    body = buf;
    const contentType = request.headers.get('content-type') || '';
    try {
      if (/application\/json/i.test(contentType)) {
        const text = new TextDecoder().decode(buf);
        parsedJson = JSON.parse(text);
      } else if (/application\/x-www-form-urlencoded/i.test(contentType)) {
        const text = new TextDecoder().decode(buf);
        parsedForm = new URLSearchParams(text);
      }
    } catch (_) {}
  }

  const proxiedRequest = new Request(functionUrl.toString(), {
    method: request.method,
    headers,
    body
  });

  const response = await fetch(proxiedRequest);

  // 简短日志头（不包含敏感信息）
  try {
    const ok = response.ok;
    const status = response.status;
    console.log(`[BFF] ${request.method} ${url.pathname} -> ${functionUrl.pathname} ${status}${ok ? '' : ' (fail)'}`);
  } catch (_) {}

  // 直接透传响应
  return response;
};

