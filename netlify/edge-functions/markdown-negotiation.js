/**
 * Netlify Edge Function: Markdown for Agents
 * - 检测 Accept: text/markdown 请求头
 * - 将 HTML 响应转换为 Markdown 版本返回
 * - 浏览器请求保持 HTML 默认响应
 */

// HTML 到 Markdown 的简易转换器
function htmlToMarkdown(html) {
  if (!html) return '';

  let md = html;

  // 第一步：移除危险标签及其内容（带空格的结束标签也要匹配）
  md = md.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  md = md.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');

  // 移除 HTML 注释
  md = md.replace(/<!--[\s\S]*?-->/g, '');

  // 标题转换
  md = md.replace(/<h1\b[^>]*>(.*?)<\/h1\s*>/gi, '# $1\n\n');
  md = md.replace(/<h2\b[^>]*>(.*?)<\/h2\s*>/gi, '## $1\n\n');
  md = md.replace(/<h3\b[^>]*>(.*?)<\/h3\s*>/gi, '### $1\n\n');
  md = md.replace(/<h4\b[^>]*>(.*?)<\/h4\s*>/gi, '#### $1\n\n');
  md = md.replace(/<h5\b[^>]*>(.*?)<\/h5\s*>/gi, '##### $1\n\n');
  md = md.replace(/<h6\b[^>]*>(.*?)<\/h6\s*>/gi, '###### $1\n\n');

  // 链接转换
  md = md.replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a\s*>/gi, '[$2]($1)');

  // 图片转换
  md = md.replace(/<img\b[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img\b[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // 粗体和斜体
  md = md.replace(/<strong\b[^>]*>(.*?)<\/strong\s*>/gi, '**$1**');
  md = md.replace(/<b\b[^>]*>(.*?)<\/b\s*>/gi, '**$1**');
  md = md.replace(/<em\b[^>]*>(.*?)<\/em\s*>/gi, '*$1*');
  md = md.replace(/<i\b[^>]*>(.*?)<\/i\s*>/gi, '*$1*');

  // 代码块
  md = md.replace(/<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code\s*><\/pre\s*>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<code\b[^>]*>(.*?)<\/code\s*>/gi, '`$1`');

  // 列表
  md = md.replace(/<li\b[^>]*>(.*?)<\/li\s*>/gi, '- $1\n');

  // 段落和换行
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p\b[^>]*>(.*?)<\/p\s*>/gi, '$1\n\n');
  md = md.replace(/<div\b[^>]*>(.*?)<\/div\s*>/gi, '$1\n');
  md = md.replace(/<section\b[^>]*>([\s\S]*?)<\/section\s*>/gi, '$1\n');

  // 移除剩余 HTML 标签
  md = md.replace(/<[^>]+>/g, '');

  // HTML 实体解码（安全顺序，避免双重解码）
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // 清理多余空行
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

// 主页的 Markdown 版本
const HOME_MARKDOWN = `# eSIM Tools

eSIM 管理工具集，支持 Giffgaff 与 Simyo 的 eSIM 申请与管理。

## 功能

- **Giffgaff eSIM**: OAuth 认证、MFA 验证、eSIM 激活
- **Simyo eSIM**: 登录、设备更换、eSIM 激活
- **QR 码生成**: eSIM 配置二维码生成与扫描

## 快速开始

### Giffgaff 用户
1. 访问 [Giffgaff eSIM 管理](/giffgaff)
2. 使用 Giffgaff 账号登录
3. 完成 MFA 验证
4. 选择 eSIM 操作

### Simyo 用户
1. 访问 [Simyo eSIM 管理](/simyo)
2. 使用 Simyo 账号登录
3. 选择设备更换或激活

## API 文档

如需 API 访问，请参考：
- [API Catalog](/.well-known/api-catalog)
- [OAuth 保护资源](/.well-known/oauth-protected-resource)

## 联系

- GitHub: https://github.com/Silentely/eSIM-Tools
- Issues: https://github.com/Silentely/eSIM-Tools/issues
`;

export default async (request, context) => {
  const accept = request.headers.get('Accept') || '';

  // 仅在请求 Accept 包含 text/markdown 时处理
  if (!accept.includes('text/markdown')) {
    return context.next();
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  // 获取原始 HTML 响应
  const response = await context.next();
  const contentType = response.headers.get('Content-Type') || '';

  // 仅处理 HTML 响应
  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();

  let markdown;

  // 针对特定路径提供优化的 Markdown
  if (pathname === '/' || pathname === '/index.html') {
    markdown = HOME_MARKDOWN;
  } else {
    // 通用 HTML 到 Markdown 转换
    markdown = htmlToMarkdown(html);
  }

  // 返回 Markdown 响应
  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Markdown-Tokens': String(markdown.split(/\s+/).length),
      'X-Content-Source': 'html',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};

export const config = {
  path: ['/'],
};
