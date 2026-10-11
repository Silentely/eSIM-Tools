/**
 * Netlify Edge Function: Sentry Tunnel
 *
 * 职责：
 * - 接收前端向 /api/sentry-tunnel 发送的 Sentry Envelope 数据包
 * - 验证 DSN host 与 Project ID 白名单，杜绝开放代理风险
 * - 将 Envelope 数据转发至 Sentry 官方 Ingest 接口
 * - 绕过客户端广告拦截插件（如 uBlock Origin, AdGuard 等）对 *.ingest.sentry.io 的拦截
 */

function getEnv(name, fallback = '') {
  return (typeof Deno !== 'undefined' && Deno.env && Deno.env.get(name)) || fallback;
}

// 默认允许的 Sentry Host 和 Project ID（与项目配置对齐）
const DEFAULT_ALLOWED_HOSTS = [
  'o493416.ingest.us.sentry.io',
  'o493416.ingest.sentry.io'
];
const DEFAULT_ALLOWED_PROJECTS = ['4510527882199040'];

function getAllowedTargets() {
  const allowedHosts = new Set(DEFAULT_ALLOWED_HOSTS);
  const allowedProjects = new Set(DEFAULT_ALLOWED_PROJECTS);

  // 如果环境变量中配置了 SENTRY_DSN，动态解析并加入白名单
  const configuredDsn = getEnv('SENTRY_DSN');
  if (configuredDsn) {
    try {
      const parsed = new URL(configuredDsn);
      if (parsed.host) allowedHosts.add(parsed.host);
      const projId = parsed.pathname.replace(/^\//, '').trim();
      if (projId) allowedProjects.add(projId);
    } catch (_) {
      // 忽略非法 DSN 格式
    }
  }

  return { allowedHosts, allowedProjects };
}

function buildCorsHeaders(requestOrigin) {
  return {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default async (request, context) => {
  const requestOrigin = request.headers.get('origin') || '';
  const corsHeaders = buildCorsHeaders(requestOrigin);

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // 仅允许 POST 方法
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  try {
    const rawBody = await request.text();
    if (!rawBody || !rawBody.trim()) {
      return new Response(JSON.stringify({ error: 'Empty envelope body' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Sentry Envelope 格式的第一行为 JSON Header
    const firstNewline = rawBody.indexOf('\n');
    const headerLine = firstNewline === -1 ? rawBody : rawBody.slice(0, firstNewline);

    let header;
    try {
      header = JSON.parse(headerLine);
    } catch (parseErr) {
      return new Response(JSON.stringify({ error: 'Invalid envelope header JSON' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // 从 Header 中解析 DSN
    const dsnStr = header && header.dsn;
    if (!dsnStr || typeof dsnStr !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing DSN in envelope header' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    let dsnUrl;
    try {
      dsnUrl = new URL(dsnStr);
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Malformed DSN URL' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const host = dsnUrl.host;
    const projectId = dsnUrl.pathname.replace(/^\//, '').trim();

    // 校验合法性，杜绝开放代理
    const { allowedHosts, allowedProjects } = getAllowedTargets();
    if (!allowedHosts.has(host) || !allowedProjects.has(projectId)) {
      console.warn(`[Sentry Tunnel] Blocked unallowed target: host=${host}, project=${projectId}`);
      return new Response(JSON.stringify({ error: 'Forbidden target DSN' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // 向上游 Sentry 发送请求
    const upstreamUrl = `https://${host}/api/${projectId}/envelope/`;
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
      },
      body: rawBody,
    });

    const responseBody = await upstreamResponse.text();

    return new Response(responseBody, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': upstreamResponse.headers.get('Content-Type') || 'application/json',
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error('[Sentry Tunnel] Internal proxy error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};
