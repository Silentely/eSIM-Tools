# Font Awesome 图标修复

## 🔍 问题描述

部署后图标丢失，原因是 Font Awesome 通过 CDN 加载，在部署环境中可能存在网络问题或 CDN 访问问题。

## 🛠️ 修复方案

### 1. 下载本地 Font Awesome 文件

创建目录 `src/assets/fontawesome/` 并下载以下文件：

- `all.min.css` — Font Awesome CSS 文件
- `fa-solid-900.woff2` — Solid 图标字体
- `fa-brands-400.woff2` — Brands 图标字体
- `fa-regular-400.woff2` — Regular 图标字体

### 2. 修改字体路径

使用 sed 命令批量替换 CSS 文件中的字体路径：

```bash
sed -i '' 's|../webfonts/|./|g' src/assets/fontawesome/all.min.css
```

### 3. 更新 HTML 文件

将所有 HTML 文件中的 Font Awesome 引用从 CDN 改为本地：

**index.html:**
```html
<!-- 修改前 -->
<link rel="preload" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css" as="style" onload="this.rel='stylesheet'">

<!-- 修改后 -->
<link rel="stylesheet" href="/src/assets/fontawesome/all.min.css">
```

**src/giffgaff/giffgaff_modular.html:**
```html
<link rel="stylesheet" href="/src/assets/fontawesome/all.min.css">
```

**src/simyo/simyo_modular.html:**
```html
<link rel="stylesheet" href="/src/assets/fontawesome/all.min.css">
```

### 4. 更新 CSP 策略

修改 Content Security Policy，允许本地字体文件：

```html
<!-- 修改前 -->
font-src 'self' https://cdnjs.cloudflare.com;

<!-- 修改后 -->
font-src 'self' data:;
```

## 🧪 测试验证

创建测试页面 `test-icons.html` 验证所有常用图标是否正常显示。

## ✅ 修复优势

1. **可靠性** — 不依赖外部 CDN，避免网络问题
2. **性能** — 本地加载更快，减少网络请求
3. **一致性** — 确保所有环境下的图标显示一致
4. **安全性** — 减少对外部资源的依赖

## 📁 文件结构

```
src/assets/fontawesome/
├── all.min.css          # Font Awesome CSS 文件
├── fa-solid-900.woff2   # Solid 图标字体
├── fa-brands-400.woff2  # Brands 图标字体
└── fa-regular-400.woff2 # Regular 图标字体
```

## ⚠️ 注意事项

- 确保字体文件路径正确
- 定期更新 Font Awesome 版本
- 在生产环境中验证图标显示
