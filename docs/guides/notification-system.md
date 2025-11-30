# 通知系统使用指南

## 概述

eSIM-Tools 通知系统是一个轻量级的消息通知解决方案，支持在部署时自动显示重要更新和修复信息。

## 架构设计

### 组件构成

1. **前端通知组件** (`notification-manager.js`)
   - 轻量级Toast通知UI
   - 支持4种类型：success、warning、error、info
   - 自动显示/隐藏机制
   - 响应式设计

2. **通知服务** (`notification-service.js`)
   - 定期从后端获取通知
   - 防止重复显示（LocalStorage记录）
   - 自动初始化和轮询

3. **后端API** (`netlify/functions/notifications.js`)
   - Netlify Serverless Function
   - 提供通知消息查询接口
   - 支持多种查询模式

4. **样式系统** (`notification.css`)
   - 与Design System完美融合
   - 优雅的渐变背景
   - 流畅的动画效果
   - 支持减少动效(prefers-reduced-motion)

---

## 快速开始

### 1. 前端使用

#### 基础用法

```javascript
import NotificationManager from './modules/notification-manager.js';

// 显示成功通知
NotificationManager.success('操作成功！');

// 显示警告通知
NotificationManager.warning('请注意检查输入');

// 显示错误通知
NotificationManager.error('操作失败，请重试');

// 显示信息通知
NotificationManager.info('这是一条提示信息');
```

#### 高级用法

```javascript
// 自定义配置
NotificationManager.show({
  message: '自定义消息',
  type: 'success',           // success | warning | error | info
  duration: 8000,            // 持续时间(ms)，0表示不自动关闭
  closable: true             // 是否显示关闭按钮
});

// 手动关闭通知
const id = NotificationManager.info('这条消息可以手动关闭');
setTimeout(() => {
  NotificationManager.hide(id);
}, 3000);

// 清除所有通知
NotificationManager.clearAll();
```

### 2. 后端配置

#### 添加新通知

编辑 `netlify/functions/notifications.js`：

```javascript
const NOTIFICATIONS = [
  {
    id: 'fix-400-error',           // 唯一标识
    message: '已修复报错400问题',   // 通知消息
    type: 'success',               // 类型
    timestamp: '2025-01-23T10:00:00Z',
    active: true,                  // 是否激活
    priority: 1                    // 优先级（数字越小优先级越高）
  },
  {
    id: 'new-feature',
    message: '新功能：支持批量导入',
    type: 'info',
    timestamp: '2025-01-22T15:00:00Z',
    active: true,
    priority: 2
  }
];
```

#### API端点

**获取所有通知**
```
GET /.netlify/functions/notifications?mode=all
```

**获取最新通知**
```
GET /.netlify/functions/notifications?mode=latest
```

**响应格式**
```json
{
  "success": true,
  "data": {
    "id": "fix-400-error",
    "message": "已修复报错400问题",
    "type": "success",
    "timestamp": "2025-01-23T10:00:00Z",
    "active": true,
    "priority": 1
  },
  "timestamp": "2025-01-23T12:34:56.789Z"
}
```

### 3. 自动化集成

通知系统已自动集成到主页面 (`index.html`)，会在页面加载时：

1. 初始化通知服务
2. 检查是否有新通知
3. 自动显示未读通知
4. 每5分钟轮询一次

---

## 通知类型与样式

### Success (成功)
- **颜色**: 绿色渐变
- **图标**: check-circle
- **用途**: 操作成功、功能修复

```javascript
NotificationManager.success('已修复报错400问题');
```

### Warning (警告)
- **颜色**: 橙色渐变
- **图标**: exclamation-triangle
- **用途**: 重要提示、注意事项

```javascript
NotificationManager.warning('请及时更新到最新版本');
```

### Error (错误)
- **颜色**: 红色渐变
- **图标**: times-circle
- **用途**: 错误提示、失败信息

```javascript
NotificationManager.error('操作失败，请稍后重试');
```

### Info (信息)
- **颜色**: 紫色渐变
- **图标**: info-circle
- **用途**: 一般信息、新功能通知

```javascript
NotificationManager.info('新功能：支持OAuth认证');
```

---

## 部署场景

### 场景1: 修复Bug后通知用户

1. 修复代码中的Bug
2. 在 `notifications.js` 中添加通知：

```javascript
{
  id: 'fix-mfa-bug-20250123',
  message: '已修复MFA验证失败问题，请刷新页面',
  type: 'success',
  timestamp: new Date().toISOString(),
  active: true,
  priority: 1
}
```

3. 部署到Netlify
4. 用户访问时自动显示通知

### 场景2: 新功能上线

```javascript
{
  id: 'feature-batch-import',
  message: '新功能：现在支持批量导入eSIM配置！',
  type: 'info',
  timestamp: new Date().toISOString(),
  active: true,
  priority: 2
}
```

### 场景3: 重要维护通知

```javascript
{
  id: 'maintenance-notice',
  message: '系统将于今晚22:00-23:00进行维护',
  type: 'warning',
  timestamp: new Date().toISOString(),
  active: true,
  priority: 1
}
```

---

## 最佳实践

### 1. 通知ID命名规范

使用有意义的ID，建议格式：
```
{type}-{feature}-{date}
```

示例：
- `fix-400-error-20250123`
- `feature-oauth-20250120`
- `warning-maintenance-20250125`

### 2. 消息内容

- ✅ 简洁明了（20-50字）
- ✅ 说明问题和解决方案
- ✅ 使用友好的语气
- ❌ 避免技术术语
- ❌ 避免过长的文本

### 3. 优先级设置

- **Priority 1**: 紧急修复、重要功能
- **Priority 2**: 一般更新、新功能
- **Priority 3**: 次要信息、提示

### 4. 激活/停用管理

及时停用过期通知：

```javascript
{
  id: 'old-notification',
  message: '已过期的通知',
  active: false,  // 停用
  // ...
}
```

---

## 高级功能

### 1. 清除已显示记录（用于测试）

打开浏览器控制台：

```javascript
// 清除已显示记录，再次刷新会重新显示所有通知
NotificationService.clearShownNotifications();
```

### 2. 自定义轮询间隔

编辑 `notification-service.js`:

```javascript
constructor() {
  this.checkInterval = 3 * 60 * 1000; // 改为3分钟
  // ...
}
```

### 3. 手动触发检查

```javascript
import NotificationService from './modules/notification-service.js';

// 手动检查新通知
NotificationService.checkAndShowNotifications();
```

---

## 故障排查

### 问题1: 通知不显示

**检查清单**:
1. 确认 `notification.css` 已正确引入
2. 检查浏览器控制台是否有错误
3. 验证后端API返回正常
4. 清除已显示记录后重试

**解决方案**:
```javascript
// 控制台执行
NotificationService.clearShownNotifications();
location.reload();
```

### 问题2: 样式异常

**可能原因**:
- CSP策略阻止样式加载
- CSS文件路径错误

**解决方案**:
检查 `index.html` 中的样式引入：
```html
<link rel="stylesheet" href="/src/styles/notification.css">
```

### 问题3: API调用失败

**检查清单**:
1. 确认Function已正确部署
2. 检查网络请求是否被拦截
3. 验证CORS配置

---

## 代码规范

### JavaScript

遵循项目统一规范：

```javascript
// ✅ 使用单例模式
const notificationManager = new NotificationManager();
export default notificationManager;

// ✅ 使用Logger记录关键信息
Logger.log('[NotificationService] 检查完成');

// ✅ 错误处理
try {
  await this.checkAndShowNotifications();
} catch (error) {
  Logger.error('[NotificationService] 检查失败:', error.message);
}
```

### CSS

使用Design System变量：

```css
.notification {
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-lg);
  transition: var(--transition-base);
}
```

---

## 性能优化

1. **懒加载**: 通知系统仅在需要时初始化
2. **防抖**: 5分钟轮询间隔避免频繁请求
3. **缓存**: LocalStorage记录已显示通知
4. **轻量级**: CSS仅3KB，JS模块化加载

---

## 安全考虑

1. **XSS防护**: 所有消息通过 `escapeHtml` 转义
2. **CORS**: API仅允许同源请求
3. **数据验证**: 严格校验通知格式
4. **LocalStorage**: 仅存储通知ID，不存储敏感数据

---

## 未来扩展

### 计划功能

1. **持久化存储**: 使用数据库存储通知
2. **用户偏好**: 允许用户关闭特定类型通知
3. **国际化**: 支持多语言通知消息
4. **通知中心**: 查看历史通知
5. **通知分组**: 按类别分组显示

---

## 总结

eSIM-Tools 通知系统提供了一个简单而强大的方式来向用户传达重要信息。通过合理使用通知类型和优先级，可以有效提升用户体验。

**关键优势**:
- 🚀 简单易用
- 🎨 美观优雅
- ⚡ 性能优异
- 🔒 安全可靠
- 📱 响应式设计

---

**最后更新**: 2025-01-23
**维护者**: eSIM Tools Team
