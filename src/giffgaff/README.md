# Giffgaff eSIM 工具 - 模块化版本

## 🚀 快速开始

### 使用模块化版本

访问重构后的页面：
```
https://esim.cosr.eu.org/giffgaff-modular
```

或本地开发：
```bash
npm start
# 访问 http://localhost:3000/src/giffgaff/giffgaff_modular.html
```

## 📂 文件说明

### HTML文件
- **`giffgaff_modular.html`** - 重构后的模块化版本（推荐使用）
- **`giffgaff_complete_esim.html`** - 原始单文件版本（备份保留）

### 样式文件 (`styles/`)
- **`giffgaff-base.css`** - 基础样式和CSS变量
- **`giffgaff-components.css`** - 组件样式（按钮、卡片等）
- **`giffgaff-service-time.css`** - 服务时间提醒专用样式
- **`giffgaff-animations.css`** - 所有动画效果
- **`giffgaff-responsive.css`** - 响应式设计

### JavaScript模块 (`js/modules/`)
- **`state-manager.js`** - 应用状态管理
- **`ui-controller.js`** - UI控制和更新
- **`oauth-handler.js`** - OAuth 2.0认证
- **`cookie-handler.js`** - Cookie验证和监控
- **`mfa-handler.js`** - 多因素认证
- **`esim-service.js`** - eSIM相关操作
- **`utils.js`** - 通用工具函数
- **`api-config.js`** - API配置和端点

### 主应用
- **`giffgaff-app.js`** - 应用入口，整合所有模块

## 🔄 版本切换

### 切换到模块化版本

修改 `netlify.toml`：
```toml
[[redirects]]
  from = "/giffgaff"
  to = "/src/giffgaff/giffgaff_modular.html"
  status = 200
```

或修改 `server.js`：
```javascript
app.get('/giffgaff', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/giffgaff/giffgaff_modular.html'));
});
```

### 回退到原始版本

如需回退，只需将路由改回：
```toml
[[redirects]]
  from = "/giffgaff"
  to = "/src/giffgaff/giffgaff_complete_esim.html"
  status = 200
```

## 🎨 样式定制

所有样式变量定义在 `giffgaff-base.css` 的 `:root` 中：

```css
:root {
    --primary: #ffcc00;      /* 主色调 */
    --secondary: #ffffff;    /* 次要色 */
    --success: #4cc9f0;      /* 成功色 */
    --warning: #f72585;      /* 警告色 */
    /* ... 更多变量 */
}
```

修改这些变量即可快速定制主题。

## 🔧 开发指南

### 添加新功能

1. **确定功能归属模块**
2. **在对应模块中添加方法**
3. **在 `giffgaff-app.js` 中绑定事件**
4. **更新UI（如需要）**

示例 - 添加新的API调用：

```javascript
// 1. 在 esim-service.js 中添加方法
async newApiCall() {
    const state = stateManager.getState();
    const response = await fetch(this.apiEndpoints.newEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: state.accessToken })
    });
    return await response.json();
}

// 2. 在 giffgaff-app.js 中调用
async handleNewFeature() {
    const result = await esimService.newApiCall();
    uiController.showStatus(element, result.message, 'success');
}
```

### 调试技巧

1. **查看状态**：
```javascript
import { stateManager } from './modules/state-manager.js';
console.log(stateManager.getState());
```

2. **监控状态变化**：
```javascript
stateManager.subscribe((state) => {
    console.log('状态更新:', state);
});
```

3. **浏览器开发工具**：
   - Network标签：查看API请求
   - Console：查看日志输出
   - Application → Local Storage：查看持久化数据

## 📋 功能清单

所有原有功能均已保留：

- ✅ OAuth 2.0 PKCE登录
- ✅ Cookie快速登录
- ✅ 邮件/短信MFA验证
- ✅ 会员信息获取
- ✅ eSIM预订
- ✅ 短信验证码激活（推荐）
- ✅ 手动激活流程
- ✅ LPA获取和二维码生成
- ✅ 会话持久化和恢复
- ✅ Cookie有效性监控
- ✅ 服务时间检查
- ✅ 响应式设计
- ✅ 无障碍支持

## 🐛 故障排查

### 问题：模块加载失败

**症状：** 控制台显示 "Failed to load module"

**解决方案：**
1. 确认服务器支持ES6模块（MIME类型：`text/javascript`）
2. 检查文件路径是否正确
3. 确认浏览器支持ES6模块

### 问题：样式未生效

**症状：** 页面样式混乱

**解决方案：**
1. 检查CSS文件路径
2. 确认所有CSS文件都已加载
3. 查看浏览器控制台是否有404错误

### 问题：功能异常

**症状：** 某些功能不工作

**解决方案：**
1. 对比原始版本 `giffgaff_complete_esim.html`
2. 检查浏览器控制台错误
3. 验证API端点配置
4. 检查状态管理是否正常

## 📚 相关文档

- **[重构指南](./REFACTORING_GUIDE.md)** - 详细的重构说明
- **[重构总结](./REFACTORING_SUMMARY.md)** - 重构成果对比
- **[用户指南](../../docs/User_Guide.md)** - 使用教程
- **[架构文档](../../docs/ARCHITECTURE.md)** - 项目架构

## 🤝 贡献

欢迎提交改进建议和Pull Request！

### 代码规范
- 遵循ES6+语法
- 使用有意义的变量名
- 添加必要的注释
- 保持代码简洁（KISS原则）

### 提交前检查
- [ ] 代码格式化
- [ ] 功能测试通过
- [ ] 无控制台错误
- [ ] 响应式布局正常

---

**版本：** v2.0.0-modular  
**最后更新：** 2025-10-31  
**维护者：** eSIM Tools Team