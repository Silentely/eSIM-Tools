#!/usr/bin/env node
/**
 * 生成 AI Agent 友好元数据文件
 * - robots.txt（含 AI 爬虫规则 + Content-Signal）
 * - sitemap.xml
 * - .well-known/api-catalog
 * - .well-known/openid-configuration
 * - .well-known/oauth-protected-resource
 * - .well-known/mcp/server-card.json
 * - .well-known/agent-skills/index.json
 */

const fs = require('fs');
const path = require('path');
const BuildLogger = require('./logger.js');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const SITE_URL = 'https://esim.cosr.eu.org';

// 规范 URL 列表
const CANONICAL_URLS = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/giffgaff', priority: '0.9', changefreq: 'weekly' },
  { loc: '/simyo', priority: '0.9', changefreq: 'weekly' },
];

/**
 * 生成 robots.txt
 * 包含：标准爬虫规则、AI 爬虫规则、Content-Signal 声明
 */
function generateRobotsTxt() {
  return `# eSIM-Tools robots.txt
# https://www.rfc-editor.org/rfc/rfc9309

User-agent: *
Allow: /
Disallow: /api/
Disallow: /bff/
Disallow: /src/
Disallow: /.netlify/
Disallow: /coverage/

# AI 爬虫规则
User-agent: GPTBot
Allow: /
Disallow: /api/
Disallow: /bff/

User-agent: OAI-SearchBot
Allow: /
Disallow: /api/
Disallow: /bff/

User-agent: Claude-Web
Allow: /
Disallow: /api/
Disallow: /bff/

User-agent: ClaudeBot
Allow: /
Disallow: /api/
Disallow: /bff/

User-agent: Google-Extended
Allow: /
Disallow: /api/
Disallow: /bff/

User-agent: Bingbot
Allow: /
Disallow: /api/
Disallow: /bff/

# 内容信号声明 (Content-Signal)
# https://contentsignals.org/
Content-Signal: ai-train=no, search=yes, ai-input=no

# 站点地图
Sitemap: ${SITE_URL}/sitemap.xml
`;
}

/**
 * 生成 sitemap.xml
 */
function generateSitemap() {
  const urls = CANONICAL_URLS.map(({ loc, priority, changefreq }) => `
  <url>
    <loc>${SITE_URL}${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>`;
}

/**
 * 生成 API Catalog (RFC 9727)
 */
function generateApiCatalog() {
  return JSON.stringify({
    linkset: [
      {
        anchor: `${SITE_URL}/bff/`,
        'service-desc': {
          href: `${SITE_URL}/docs/api`,
          title: 'eSIM Tools API Documentation'
        },
        'service-doc': {
          href: `${SITE_URL}/README.md`,
          title: 'Project README'
        },
        status: {
          href: '/.netlify/functions/health',
          title: 'Health Check'
        }
      }
    ]
  }, null, 2);
}

/**
 * 生成 OAuth Protected Resource Metadata (RFC 9728)
 */
function generateOAuthProtectedResource() {
  return JSON.stringify({
    resource: `${SITE_URL}`,
    authorization_servers: [
      'https://id.giffgaff.com'
    ],
    scopes_supported: [
      'openid',
      'profile'
    ],
    bearer_methods_supported: [
      'header'
    ],
    resource_documentation: `${SITE_URL}/docs/api`
  }, null, 2);
}

/**
 * 生成 MCP Server Card (SEP-1649)
 */
function generateMcpServerCard() {
  return JSON.stringify({
    name: 'eSIM Tools MCP Server',
    description: 'eSIM management tools for Giffgaff and Simyo users',
    version: '2.0.0',
    homepage: SITE_URL,
    repository: 'https://github.com/Silentely/eSIM-Tools',
    transport: {
      type: 'http',
      url: `${SITE_URL}/bff/`
    },
    capabilities: {
      tools: [
        {
          name: 'giffgaff-oauth',
          description: 'Giffgaff OAuth token exchange and authentication'
        },
        {
          name: 'simyo-esim-activate',
          description: 'Simyo eSIM activation and management'
        }
      ]
    }
  }, null, 2);
}

/**
 * 生成 Agent Skills Discovery Index
 */
function generateAgentSkillsIndex() {
  return JSON.stringify({
    $schema: 'https://agentskills.io/schema/v0.2.0',
    skills: [
      {
        name: 'giffgaff-esim',
        type: 'action',
        description: 'Manage Giffgaff eSIM: OAuth authentication, MFA verification, and eSIM activation via GraphQL',
        url: `${SITE_URL}/.well-known/agent-skills/giffgaff-esim`,
        sha256: 'placeholder'
      },
      {
        name: 'simyo-esim',
        type: 'action',
        description: 'Manage Simyo eSIM: login, device swap, and eSIM activation',
        url: `${SITE_URL}/.well-known/agent-skills/simyo-esim`,
        sha256: 'placeholder'
      }
    ]
  }, null, 2);
}

/**
 * 确保目录存在
 */
async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

/**
 * 写入文件（带日志）
 */
async function writeFile(filePath, content) {
  const relativePath = path.relative(distDir, filePath);
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, content, 'utf-8');
  BuildLogger.log(`  ✓ ${relativePath}`);
}

/**
 * 主函数
 */
async function main() {
  BuildLogger.log('🤖 生成 AI Agent 元数据文件...');

  // robots.txt
  await writeFile(path.join(distDir, 'robots.txt'), generateRobotsTxt());

  // sitemap.xml
  await writeFile(path.join(distDir, 'sitemap.xml'), generateSitemap());

  // .well-known/api-catalog
  await writeFile(
    path.join(distDir, '.well-known', 'api-catalog'),
    generateApiCatalog()
  );

  // .well-known/oauth-protected-resource
  await writeFile(
    path.join(distDir, '.well-known', 'oauth-protected-resource'),
    generateOAuthProtectedResource()
  );

  // .well-known/mcp/server-card.json
  await writeFile(
    path.join(distDir, '.well-known', 'mcp', 'server-card.json'),
    generateMcpServerCard()
  );

  // .well-known/agent-skills/index.json
  await writeFile(
    path.join(distDir, '.well-known', 'agent-skills', 'index.json'),
    generateAgentSkillsIndex()
  );

  BuildLogger.success('  AI Agent 元数据文件生成完成');
}

main().catch(err => {
  console.error('生成 Agent 元数据失败:', err);
  process.exitCode = 1;
});
