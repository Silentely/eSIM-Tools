<div align="center">
<h1 align="center">eSIM Tools 🚀<br><img align='middle' src='https://anay.cosr.eu.org/?text=@Silentely/eSIM-Tools'></img></h1>
<img align='middle' src='https://anay.cosr.eu.org/?repo=Silentely/eSIM-Tools'></img>
<br>
<img src="https://img.shields.io/github/forks/Silentely/eSIM-Tools?color=orange" alt="GitHub forks">
<img src="https://img.shields.io/github/issues/Silentely/eSIM-Tools?color=green" alt="GitHub issues">
<br>
<img src="https://img.shields.io/github/license/Silentely/eSIM-Tools?color=ff69b4" alt="License">
<img src="https://img.shields.io/github/languages/code-size/Silentely/eSIM-Tools?color=blueviolet" alt="Code size">
<img src="https://img.shields.io/github/last-commit/Silentely/eSIM-Tools/main?label=%E4%B8%8A%E6%AC%A1%E6%9B%B4%E6%96%B0&color=success" alt="Last commit">
<img src="https://api.netlify.com/api/v1/badges/8fc159e2-3996-4e1b-bf9d-1945a3474682/deploy-status" alt="Netlify Status">
<br>
[:us: English Version](./README_EN.md)
<br>
</div>

<p align="center">
  <img src="src/assets/og-image.png" alt="eSIM Tools - Giffgaff & Simyo eSIM 在线管理工具" width="600">
</p>

## 📱 这是什么？

**eSIM Tools** 是一个免费的在线工具，帮助 **已有 Giffgaff 或 Simyo 号码的用户**：

- 🔄 将物理 SIM 卡转换为 eSIM（无需换卡）
- 📲 更换设备时快速转移 eSIM
- 📷 生成 eSIM 二维码，扫码即可激活

> 💡 **1-2 分钟即可完成**，无需联系客服，全程自动化

---

## ✨ 适合谁用？

### 🇬🇧 Giffgaff 用户

✅ 已有 Giffgaff 号码（英国运营商）
✅ 想把物理 SIM 卡换成 eSIM
✅ 换新手机需要重新激活 eSIM
❌ 新用户申请号码（需先通过官方或第三方获取号码）

### 🇳🇱 Simyo 用户

✅ 已有 Simyo 号码（荷兰运营商，06 开头）
✅ 需要更换设备或转换为 eSIM
❌ 新用户申请号码（需先通过官方 APP 注册）

---

## 🚀 快速开始

### 在线使用（推荐）

**👉 访问：[https://esim.cosr.eu.org](https://esim.cosr.eu.org)**

- ✅ 无需安装，打开即用
- ✅ 支持所有功能，定期更新
- ✅ 支持离线使用，数据本地处理

### 使用流程

#### 🇬🇧 Giffgaff（推荐：短信验证码激活）

1. **登录账户** - 选择安全登录方式
2. **邮件/短信验证** - 输入收到的验证码
3. **短信验证码激活** - 输入 6 位短信验证码
4. **获取二维码** - 自动生成，扫码即可激活

> 📖 **图文教程**：[Giffgaff 使用教程](./docs/User_Guide.md)（含视频演示）

#### 🇳🇱 Simyo

1. **账户登录** - 输入手机号（06 开头）和密码
2. **选择服务** - 设备更换或获取现有 eSIM
3. **验证码确认** - 输入短信验证码
4. **扫码安装** - 使用生成的二维码在新设备上安装

---

## 🖼️ 界面预览

<details>
<summary>点击展开查看截图</summary>

### 主页

![主页-功能总览](./src/assets/images/home-preview.jpg)

### Giffgaff eSIM 工具

![Giffgaff-工具界面](./src/assets/images/giffgaff-preview.jpg)

### Simyo eSIM 工具

![Simyo-工具界面](./src/assets/images/simyo-preview.jpg)

</details>

---

## ❓ 常见问题

### Giffgaff 相关

<details>
<summary><strong>Q: 推荐使用哪种激活方式？</strong></summary>

**A**: 推荐"短信验证码激活"，全自动流程，只需输入短信验证码即可完成所有步骤。
</details>

<details>
<summary><strong>Q: 需要多久完成？</strong></summary>

**A**: 通常 1-2 分钟。发送验证码 → 输入验证码 → 自动激活 → 获取二维码。
</details>

<details>
<summary><strong>Q: 手动激活方式还能用吗？</strong></summary>

**A**: 手动激活已于 2025 年 10 月 8 日被 Giffgaff 官方停用，请使用短信验证码激活。
</details>

<details>
<summary><strong>Q: 误关页面怎么办？</strong></summary>

**A**: 重新登录后系统会从可恢复节点继续。建议激活完成前保持页面开启。
</details>

<details>
<summary><strong>Q: 什么时间可以激活？</strong></summary>

**A**: Giffgaff 服务窗口为英国时间 04:30 - 21:30。窗口外操作可能失败，页面会显示本地时间与英国时间对比。
</details>

<details>
<summary><strong>Q: 支持哪些设备？</strong></summary>

**A**:

- **Apple**: iPhone XS/XR 及更新机型、iPhone SE 2 及更新
- **Android**: Samsung Galaxy S20+、Google Pixel 3+、部分 OnePlus/华为机型
- 详细兼容性请查看设备说明书

</details>

### Simyo 相关

<details>
<summary><strong>Q: 支持哪些手机号格式？</strong></summary>

**A**: 仅支持荷兰手机号（06 开头的 10 位数字）。
</details>

<details>
<summary><strong>Q: 验证码收不到怎么办？</strong></summary>

**A**: 可选择客服验证码选项，或检查短信拦截设置。
</details>

### 安全与隐私

<details>
<summary><strong>Q: 数据安全吗？</strong></summary>

**A**:

- ✅ 所有数据在本地浏览器处理，不上传服务器
- ✅ 不存储用户密码或敏感信息
- ✅ 开源透明，代码可审计
- ✅ 建议在安全网络环境下使用

</details>

---

## 🎁 新用户优惠

如果你还没有号码，可以通过以下链接注册并获得话费赠送：

- **🇳🇱 Simyo 用户**: 新开卡享受 [额外 5 欧元话费赠送](https://vriendendeal.simyo.nl/prepaid/AZzwPzb)
- **🇬🇧 Giffgaff 用户**: 新开卡享受 [额外 5 英镑话费赠送](https://www.giffgaff.com/orders/affiliate/mowal44_1653194386268)

> ⚠️ **注意**：本工具不支持新用户直接申请号码，仅支持已有号码的 eSIM 转换和设备更换。

---

## 🛠️ 本地部署（开发者）

<details>
<summary>点击展开查看部署说明</summary>

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/Silentely/eSIM-Tools.git
cd eSIM-Tools

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp env.example .env
# 编辑 .env 填写必要配置

# 4. 启动开发服务器
npm start

# 5. 访问 http://localhost:3000
```

### 环境要求

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **现代浏览器**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+

### Netlify 部署

1. Fork 此仓库到你的 GitHub 账户
2. 在 [Netlify](https://app.netlify.com) 中连接 GitHub 仓库
3. 构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 配置环境变量（参考 `env.example`）
5. 部署完成

</details>

---

## 📚 详细文档

- **使用教程**
  - [Giffgaff 使用教程](./docs/User_Guide.md) | [English](./docs/User_Guide_EN.md)

- **技术参考**（开发者）
  - [架构说明](./docs/ARCHITECTURE.md)
  - [Giffgaff 技术参考](./docs/reference/README_giffgaff_esim.md) | [English](./docs/reference/README_giffgaff_esim_EN.md)
  - [Simyo 技术参考](./docs/reference/README_simyo_esim.md) | [English](./docs/reference/README_simyo_esim_EN.md)
  - [CORS 解决方案](./docs/guides/CORS_SOLUTION.md)

---

## 🔧 技术特性

- 🚀 **极简设计** - 原生 JavaScript，无框架依赖，打包体积小
- ⚡ **快速响应** - 全球 CDN 加速，首屏加载 < 1.2 秒
- 🔒 **隐私安全** - 所有数据本地处理，不上传服务器
- 📦 **离线可用** - 支持断网使用，网络波动不影响操作
- 🎯 **现代标准** - PWA、Web Vitals 优化，移动端友好

> 💻 **开发者文档**: 查看 [技术架构说明](./docs/ARCHITECTURE.md) 了解实现细节

---

## 🤝 贡献指南

欢迎贡献代码和提出建议！

### 参与方式

1. 🍴 Fork 项目仓库
2. 🌿 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 💾 按规范提交 (`git commit -m '✨ feat(core): 新增二维码缓存逻辑'`)
4. 📤 推送分支 (`git push origin feature/AmazingFeature`)
5. 🔃 创建 Pull Request

### 提交规范

```bash
# 格式：<emoji> <type>(scope): <中文描述>
✨ feat(auth): 新增登录态自动续期
🐛 fix(simyo): 修复验证码重试逻辑
📝 docs(readme): 更新安装说明
```

**可用命令**：

- `npm run hooks:install` - 安装 Git 钩子
- `npm test` - 运行测试
- `npm run quality-check` - 代码质量检查
- `npm run security-check` - 安全扫描

---

## 📞 支持与反馈

遇到问题或有建议？

- 📋 [提交 Issue](https://github.com/Silentely/eSIM-Tools/issues)
- 📖 查看 [项目文档](./docs/)
- 💬 参与社区讨论

---

## 📈 Star History

![](https://starchart.cc/Silentely/eSIM-Tools.svg)

---

## 📄 许可证

- **代码**: [MIT License](LICENSE)
- **文档**: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh)
  - 可自由复制、再发行，但需**提供原作者信息**及**协议声明**
  - **不可用于商业用途**（任何盈利活动均视为商业用途）

---

## ⚖️ 免责声明

<p align="center">
  <img src="https://github.com/docker/dockercraft/raw/master/docs/img/contribute.png?raw=true" alt="贡献图示" width="400">
</p>

**本工具仅供学习和个人使用**，请遵守相关服务条款。使用本工具产生的任何问题，开发者不承担责任。请在遵守当地法律法规的前提下使用。

---

<div align="center">
  <sub>Made with ❤️ by <a href="https://github.com/Silentely">Silentely</a></sub>
</div>
