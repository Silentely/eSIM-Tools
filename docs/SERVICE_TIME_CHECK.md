# Giffgaff 服务时间检查功能

## 功能描述

为 Giffgaff eSIM 申请工具添加实时时间检查功能，根据英国时间动态显示 SIM 交换服务的可用状态。

## 架构设计

服务时间检查采用模块化架构，职责分离如下：

```
app.js (编排层)
  ├── checkServiceTime()         → 调用 utils 和 dom
  ├── startServiceTimeCheck()    → 初始化 + 每分钟轮询
  │
  ├── utils.js (业务逻辑层)
  │     └── isServiceTimeAvailable()  → 英国时间窗口判断
  │
  └── dom.js (视图层)
        └── updateServiceTimeDisplay() → DOM 更新与渲染
```

### 文件位置

| 模块 | 文件 | 职责 |
|------|------|------|
| **工具函数** | `src/js/modules/giffgaff/utils.js` | 时间窗口判断逻辑 |
| **DOM 操作** | `src/js/modules/giffgaff/dom.js` | UI 渲染与更新 |
| **主控制器** | `src/js/modules/giffgaff/app.js` | 编排与定时轮询 |

## 实现细节

### 时间逻辑

- **服务窗口**：英国时间 04:30–21:30（SIM 交换服务可用）
- **窗口外**：其余时间段（部分操作可能失败或不稳定）
- **时区处理**：使用 `Intl.DateTimeFormat` 的 `Europe/London` 时区，自动处理夏令时

### 核心实现

#### 1. 时间窗口判断 (`utils.js`)

```javascript
/**
 * 服务时间检查（英国时间）
 * 英国时间凌晨 4:30 至 晚上 9:30 提供 SIM 交换服务
 * 返回 true 表示"当前处于服务可用时段"（英国时间 04:30-21:30）
 */
isServiceTimeAvailable() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour12: false, hour: '2-digit', minute: '2-digit'
  }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value || '0');

  // 服务可用区间：04:30 - 21:30（含边界）
  const afterStart = (hour > 4) || (hour === 4 && minute >= 30);
  const beforeEnd = (hour < 21) || (hour === 21 && minute <= 30);
  return afterStart && beforeEnd;
}
```

#### 2. DOM 渲染 (`dom.js`)

```javascript
updateServiceTimeDisplay(isAvailable) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const ukTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(now);

  const timeElement = document.getElementById('currentTime');
  if (timeElement) {
    timeElement.textContent = localTime;
  }
  const ukHint = document.getElementById('ukTimeHint');
  if (ukHint) {
    ukHint.textContent = tl('giffgaff.app.service.ukTime', { time: ukTime });
  }

  const alertElement = document.getElementById('serviceTimeAlert');
  if (alertElement) {
    if (isAvailable) {
      alertElement.className = 'alert alert-success';
      alertElement.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <strong>${tl('服务可用')}</strong> - ${tl('当前时间')} ${HTMLSanitizer.escapeHtml(localTime)} / UK ${HTMLSanitizer.escapeHtml(ukTime)}（04:30-21:30）
      `;
    } else {
      alertElement.className = 'alert alert-warning';
      alertElement.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <strong>${tl('服务时间外')}</strong> - ${tl('当前时间')} ${HTMLSanitizer.escapeHtml(localTime)} / UK ${HTMLSanitizer.escapeHtml(ukTime)}
        <br><small>${tl('SIM 交换服务窗口：英国时间 04:30 至 21:30。您仍可浏览信息，部分操作可能失败。')}</small>
      `;
    }
  }
}
```

#### 3. 编排与定时轮询 (`app.js`)

```javascript
startServiceTimeCheck() {
  this.checkServiceTime();
  // 每分钟检查一次
  setInterval(() => this.checkServiceTime(), 60000);
}

checkServiceTime() {
  const isAvailable = this.utils.isServiceTimeAvailable();
  this.dom.updateServiceTimeDisplay(isAvailable);
}
```

### HTML 结构

```html
<div id="serviceTimeAlert" class="alert mb-4 service-time-alert">
  <!-- 动态内容由 updateServiceTimeDisplay() 渲染 -->
  <i id="serviceTimeIcon" class="fas" aria-hidden="true"></i>
  <div id="serviceTimeMessage" class="service-time-message">
    <span class="lang-zh">当前时间在服务时间外，Giffgaff官方在英国时间04:30至21:30之间提供SIM交换服务。</span>
    <span class="lang-en">Outside of service hours. Giffgaff processes SIM swaps between 04:30 and 21:30 UK time.</span>
  </div>
</div>
```

## 功能特性

1. **模块化架构** - 逻辑、渲染、编排三层分离，便于测试和维护
2. **国际化支持** - 使用 `tl()` 函数支持中英文切换
3. **XSS 防护** - 通过 `HTMLSanitizer.escapeHtml()` 转义动态内容
4. **自动夏令时** - `Intl.DateTimeFormat` 自动处理英国夏令时切换
5. **双时区显示** - 同时显示本地时间和英国时间，便于用户对比
6. **实时更新** - 每分钟自动检查并更新状态，无需刷新页面

## 用户体验

### 服务时间外（窗口外）
- **样式**：黄色警告框 (`alert-warning`)
- **图标**：警告三角形 (`fa-exclamation-triangle`)
- **消息**：提醒用户当前在服务窗口外，部分操作可能失败

### 服务时间内（窗口内）
- **样式**：绿色成功框 (`alert-success`)
- **图标**：成功圆圈 (`fa-check-circle`)
- **消息**：提醒用户当前可以正常申请 eSIM

## 测试场景

1. **服务时间外测试**：在英国时间 21:30 至次日 04:30 期间访问页面
2. **服务时间内测试**：在英国时间 04:30–21:30 期间访问页面
3. **时间边界测试**：在 04:30 和 21:30 的边界时间测试
4. **自动更新测试**：观察每分钟的时间更新
5. **夏令时切换测试**：在 BST/GMT 切换期间验证时间判断准确性

---

**最后更新**: 2026-05-03
