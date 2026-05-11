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

  // 标题转换
  md = md.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi, '# $1\n\n');
  md = md.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/gi, '## $1\n\n');
  md = md.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3\s*>/gi, '### $1\n\n');
  md = md.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4\s*>/gi, '#### $1\n\n');
  md = md.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5\s*>/gi, '##### $1\n\n');
  md = md.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6\s*>/gi, '###### $1\n\n');

  // 链接转换
  md = md.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/gi, '[$2]($1)');

  // 图片转换
  md = md.replace(/<img\b[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img\b[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // 粗体和斜体
  md = md.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong\s*>/gi, '**$1**');
  md = md.replace(/<b\b[^>]*>([\s\S]*?)<\/b\s*>/gi, '**$1**');
  md = md.replace(/<em\b[^>]*>([\s\S]*?)<\/em\s*>/gi, '*$1*');
  md = md.replace(/<i\b[^>]*>([\s\S]*?)<\/i\s*>/gi, '*$1*');

  // 代码块
  md = md.replace(/<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code\s*><\/pre\s*>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<code\b[^>]*>([\s\S]*?)<\/code\s*>/gi, '`$1`');

  // 列表
  md = md.replace(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi, '- $1\n');

  // 段落和换行
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi, '$1\n\n');
  md = md.replace(/<div\b[^>]*>([\s\S]*?)<\/div\s*>/gi, '$1\n');
  md = md.replace(/<section\b[^>]*>([\s\S]*?)<\/section\s*>/gi, '$1\n');

  // 移除所有 HTML 注释（split 方式，避免 CodeQL incomplete-multi-character-sanitization 误报）
  md = md.split('<!--').map((part, i) => i === 0 ? part : part.substring(part.indexOf('-->') + 3)).join('');

  // 移除所有剩余 HTML 标签（逐字符扫描，不使用正则，避免 CodeQL 误报）
  let cleaned = '';
  let i = 0;
  while (i < md.length) {
    if (md[i] === '<') {
      const close = md.indexOf('>', i);
      if (close !== -1) { i = close + 1; continue; }
    }
    cleaned += md[i];
    i++;
  }
  md = cleaned;

  // HTML 实体解码（单次遍历，避免 &amp;lt; 等双重解码问题）
  md = md.replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27|#x2F);/g, (entity) => {
    const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/' };
    return map[entity.slice(1, -1)] || entity;
  });

  // 清理多余空行
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

// 主页的 Markdown 版本
const HOME_MARKDOWN = `# eSIM Tools - Giffgaff & Simyo eSIM 管理工具

第三方开源 Web 工具，为 Giffgaff 和 Simyo 用户提供 eSIM 申请、配置和管理功能。

## 核心功能

- **Giffgaff eSIM**: OAuth 2.0 PKCE 认证、MFA 多因素验证、GraphQL API 集成、自动生成 eSIM QR 码
- **Simyo eSIM**: 登录验证、设备更换、SMS/iDEAL 验证、eSIM 激活
- **QR 码生成**: eSIM 配置二维码自动生成与扫描

## 设备兼容性

支持 eSIM 的设备：
- **Apple**: iPhone XS/XR 及更新机型、iPhone SE 2 及更新
- **Android**: Samsung Galaxy S20+、Google Pixel 3+、部分 OnePlus/华为

检查方法：在手机拨号盘输入 \`*#06#\`，如显示 EID 号码则支持 eSIM

## Giffgaff eSIM 激活流程

1. 点击「使用 Giffgaff 工具」进入工具页面
2. 使用 Giffgaff 账号完成 OAuth 登录授权
3. 输入邮箱验证码完成身份验证
4. 完成 MFA 多因素认证（如已启用）
5. 查询会员资格并选择 eSIM 操作
6. 获取 eSIM 下载码或扫描 QR 码激活

**激活时间窗口**: UK 时间 4:30am - 9:30pm

## Simyo eSIM 管理流程

1. 点击「使用 Simyo 工具」进入工具页面
2. 使用 Simyo 账号完成登录验证
3. 选择设备更换或 eSIM 激活
4. 通过 SMS 短信或 iDEAL 支付验证身份
5. 确认新设备并生成 eSIM 配置

**注意**: 本工具支持生成 eSIM QR 码，简化 Simyo 激活流程

## 与官方 App 对比

| 对比项 | 本工具 | 官方 App |
|--------|--------|----------|
| 操作平台 | 浏览器 Web 端 | 仅移动端 App |
| QR 码生成 | 自动生成 | Simyo 不支持（本工具可生成） |
| 官方支持 | 非官方 | 官方支持 |
| 服务条款 | 可能违反 | 符合条款 |

## 地区与时间限制

- **Giffgaff**: 激活时间窗口 UK 时间 4:30am - 9:30pm
- **Simyo**: 服务地区荷兰 (NL)，仅支持荷兰本地用户

## 常见问题

**Q: 无法接收 SMS 短信验证码怎么办？**
A: Simyo 用户可选择 iDEAL 支付方式作为替代验证方案。

**Q: eSIM 激活需要多长时间？**
A: 通常几分钟内完成，最长可能需要 1 小时。

**Q: 是否支持在海外激活 eSIM？**
A: Giffgaff 有 UK 时间窗口限制，Simyo 主要面向荷兰本地用户。

**Q: Simyo 支持 QR 码激活吗？**
A: Simyo 官方 App 不支持 QR 码激活，但本工具可以生成 eSIM QR 码，让您通过扫描方式快速完成激活。

**Q: 使用这个工具安全吗？**
A: 所有数据处理均在本地浏览器完成。但使用第三方工具可能违反运营商服务条款。

## 技术术语说明

- **OAuth 2.0 PKCE**: 安全的授权协议，允许第三方应用访问用户数据
- **GraphQL**: 灵活的 API 查询语言
- **LPA String**: 本地配置文件激活字符串
- **SM-DP+**: 订阅管理数据准备服务器
- **MFA**: 多因素认证
- **EID**: eSIM 唯一标识号码

## 安全声明

- 本工具为非官方第三方工具，使用可能违反运营商服务条款
- 建议使用非主力号码进行测试和激活操作
- 所有数据处理均在本地浏览器完成，不上传任何敏感信息

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
