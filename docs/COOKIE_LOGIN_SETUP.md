# Cookie登录功能设置指南

## ⚠️ 重要更新 - Node.js架构

**Cookie登录功能已完全升级为现代化Node.js架构！**

- ✅ **生产环境**: 使用Netlify Functions，无需任何服务器配置
- ✅ **开发环境**: 使用Node.js Express服务器
- ✅ **自动部署**: 完全无服务器，零配置
- ❌ **PHP版本**: 已弃用，仅保留在仓库中作为参考

## 🍪 功能概述

Cookie登录功能允许用户使用已有的Giffgaff网站登录Cookie快速访问eSIM工具，无需重复OAuth认证流程。

## 🚀 现代化架构优势

### Netlify Functions版本
- **零配置部署** - 随项目自动部署
- **全球CDN** - 低延迟响应
- **自动扩展** - 无需担心并发限制
- **完整日志** - 便于调试和监控
- **HTTPS内置** - 安全传输保障

### 智能环境检测
系统会自动检测部署环境并选择合适的API端点：
- **Netlify部署** → 使用 `/.netlify/functions/verify-cookie`
- **本地开发** → 使用 `http://localhost:3000/.netlify/functions/verify-cookie`

## 📋 部署说明

### 生产环境（Netlify）
**无需任何额外配置！**

Cookie登录功能会随项目自动部署到Netlify Functions，包括：
- `netlify/functions/verify-cookie.js` - Cookie验证服务
- 自动CORS配置
- 错误处理和日志记录

### 开发环境
1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **访问应用**
   ```
   http://localhost:3000
   ```

3. **Cookie登录测试**
   - 前端会自动调用本地Node.js服务器
   - 完整的错误处理和调试信息

## 🔧 技术实现

### Cookie验证流程
1. **前端收集** - 用户输入Cookie字符串
2. **智能解析** - 解析Cookie格式并提取认证信息
3. **API调用** - 使用Cookie调用Giffgaff API验证身份
4. **Token生成** - 成功验证后返回Access Token
5. **会话建立** - 自动保存到LocalStorage，支持2小时持久化

### 安全特性
- **HTTPS强制** - 所有API调用使用安全连接
- **输入验证** - 严格的Cookie格式验证
- **错误隔离** - 详细的错误分类和处理
- **会话管理** - 自动过期和清理机制

## 🧪 测试Cookie登录

### 获取Cookie
1. 在浏览器中登录 [Giffgaff官网](https://www.giffgaff.com)
2. 打开开发者工具 (F12)
3. 切换到 `Application` 或 `Storage` 标签
4. 选择 `Cookies` → `https://www.giffgaff.com`
5. 复制所有Cookie值（格式：`name1=value1; name2=value2; ...`）
   - 建议包含含有 `token` / `session` / `auth` 关键字的 Cookie 项；越完整越好

### 验证流程
1. 在eSIM工具中选择 "Cookie登录"
2. 粘贴Cookie字符串
3. 点击 "验证Cookie"
4. 系统自动验证并跳转到相应步骤

## 🐛 故障排除

### 常见问题

**Q: Cookie验证失败怎么办？**
A: 
- 确保Cookie是从已登录的Giffgaff网站获取
- 检查Cookie格式是否完整
- 尝试重新登录Giffgaff网站获取新Cookie
- 若提示 403：登录已过期或权限不足，请刷新登录并重新获取 Cookie
- 若提示 429：请求过于频繁，请稍后重试（建议在英国时间 04:30–21:30 服务窗口内操作）
- 若提示超时：检查网络或更换环境后重试

**Q: 显示"服务器错误"？**
A: 
- 检查网络连接
- 查看浏览器控制台是否有详细错误信息
- 尝试使用OAuth登录作为备选方案

**Q: 本地开发时Cookie登录不工作？**
A: 
- 确保已运行 `npm run dev`
- 检查端口3000是否被占用
- 查看终端输出的错误信息

### 调试信息
开发环境下，所有API调用都会在浏览器控制台和Node.js终端输出详细日志，便于调试。

## 🔐 安全提示
- 仅在可信设备上粘贴 Cookie；不要在公共或不受信任的设备上使用
- 本工具不会存储您的 Cookie；仅用于调用官方接口进行验证与操作
- 使用本工具前请遵守服务条款与当地法律法规

## 📚 相关文档

- [主要README](../README.md) - 项目总览
- [架构指南](./ARCHITECTURE.md) - 技术架构详解

## 🔄 从PHP版本迁移

如果您之前使用PHP版本的Cookie登录：

1. **无需手动迁移** - 前端代码已自动适配
2. **移除PHP文件** - `verify_cookie.php` 不再需要，已从仓库删除（统一使用 Netlify Functions `/.netlify/functions/verify-cookie`）
3. **重新部署** - 使用新的Netlify Functions架构
4. **测试功能** - 验证Cookie登录是否正常工作

新的Node.js架构提供了更好的性能、可靠性和可维护性。