# Giffgaff服务时间检查功能

## 功能描述
为Giffgaff eSIM申请工具添加实时时间检查功能，根据当前时间动态显示服务状态提醒。

## 实现细节

### 时间逻辑（最新）
- **服务窗口**：英国时间 04:30–21:30（SIM 交换服务可用）
- **窗口外**：其余时间段（部分操作可能失败或不稳定）

### 显示效果

#### 服务时间外（窗口外）
- **样式**：黄色警告框 (`alert-warning`)
- **图标**：放大警告三角形 (`fa-exclamation-triangle`，1.8em)
- **消息**：提醒用户不要在此时间段操作申请eSIM
- **颜色**：橙色警告色 (`#f59e0b`)
- **动画**：警告脉冲动画 (`warning-pulse`)
- **操作提示**：红色"⚠️ 当前时间不能申请eSIM"

#### 服务时间内（其他时间段）
- **样式**：绿色成功框 (`alert-success`)
- **图标**：放大成功圆圈 (`fa-check-circle`，1.8em)
- **消息**：提醒用户当前当前时间可以申请eSIM
- **颜色**：绿色成功色 (`#10b981`)
- **动画**：成功弹跳动画 (`success-bounce`)
- **操作提示**：绿色"✅ 当前时间可以申请eSIM"

#### 时间显示
- **位置**：右侧独立显示区域
- **样式**：渐变背景，圆角设计
- **动画**：脉冲发光效果 (`pulse-glow`)
- **时间更新**：缩放动画 (`time-update`)

### 功能特性

1. **实时时间显示**
   - 显示当前时间（格式：HH:MM）
   - 每分钟自动更新
   - 右侧加粗显示，带时钟图标

2. **动态状态更新**
   - 页面加载时立即检查时间
   - 每分钟自动重新检查并更新状态

3. **视觉反馈**
   - 不同时间段显示不同的颜色和图标
   - 清晰的状态指示
   - 个性化动画效果

4. **个性化设计**
   - 图标放大显示（1.8em）
   - 悬停效果和动画
   - 渐变背景和阴影效果

### 代码实现

#### HTML结构
```html
<div id="serviceTimeAlert" class="alert mb-4">
    <div class="d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center flex-grow-1">
            <i id="serviceTimeIcon" class="fas me-3" style="font-size: 1.8em;"></i>
            <div>
                <strong>服务时间提醒：</strong>
                <span id="serviceTimeMessage"></span>
                <div id="actionMessage" class="mt-2" style="font-weight: 600;"></div>
            </div>
        </div>
        <div class="current-time-display">
            <i class="fas fa-clock me-2" style="color: #6366f1;"></i>
            <span class="time-label">当前时间：</span>
            <span id="currentTime" class="time-value"></span>
        </div>
    </div>
</div>
```

#### CSS样式
```css
/* 时间显示样式 */
.current-time-display {
    display: flex;
    align-items: center;
    background: linear-gradient(135deg, #f8fafc, #e2e8f0);
    padding: 8px 16px;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    animation: pulse-glow 2s ease-in-out infinite;
}

.time-value {
    font-size: 1.1em;
    font-weight: 700;
    color: #1e293b;
    margin-left: 4px;
    animation: time-update 0.5s ease-out;
}

/* 动画效果 */
@keyframes pulse-glow {
    0%, 100% { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
    50% { box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3); }
}

@keyframes time-update {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
}

@keyframes warning-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

@keyframes success-bounce {
    0%, 100% { transform: scale(1); }
    25%, 75% { transform: scale(1.02); }
}
```

#### JavaScript函数
```javascript
function checkServiceTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    
    // 更新当前时间显示
    const timeElement = document.getElementById('currentTime');
    timeElement.textContent = currentTime;
    // 添加时间更新动画
    timeElement.style.animation = 'none';
    timeElement.offsetHeight; // 触发重排
    timeElement.style.animation = 'time-update 0.5s ease-out';
    
    // 服务窗口：英国时间 04:30–21:30
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const hour = Number(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = Number(parts.find(p => p.type === 'minute')?.value || '0');
    const inWindow = (hour > 4 || (hour === 4 && minute >= 30)) && (hour < 21 || (hour === 21 && minute <= 30));
    
    const alertElement = document.getElementById('serviceTimeAlert');
    const iconElement = document.getElementById('serviceTimeIcon');
    const messageElement = document.getElementById('serviceTimeMessage');
    const actionMessageElement = document.getElementById('actionMessage');
    
    if (!inWindow) {
        // 在服务时间外，显示警告
        alertElement.className = 'alert alert-warning mb-4';
        iconElement.className = 'fas fa-exclamation-triangle me-3';
        iconElement.style.color = '#f59e0b';
        messageElement.innerHTML = '当前时间在服务窗口外（英国时间 04:30–21:30），SIM交换服务不可用。';
        actionMessageElement.innerHTML = '<span style="color: #dc2626; font-weight: 700;">⚠️ 当前时间不能申请eSIM</span>';
    } else {
        // 在服务时间内，显示成功提示
        alertElement.className = 'alert alert-success mb-4';
        iconElement.className = 'fas fa-check-circle me-3';
        iconElement.style.color = '#10b981';
        messageElement.innerHTML = '当前时间在服务窗口内（英国时间 04:30–21:30），SIM交换服务可用。';
        actionMessageElement.innerHTML = '<span style="color: #059669; font-weight: 700;">✅ 当前时间可以申请eSIM</span>';
    }
}
```

#### 初始化
```javascript
document.addEventListener('DOMContentLoaded', function() {
    // 初始化服务时间检查
    checkServiceTime();
    
    // 每分钟更新一次时间
    setInterval(checkServiceTime, 60000);
});
```

## 用户体验

### 优势
1. **实时反馈**：用户立即知道当前是否当前时间可以申请eSIM
2. **清晰指示**：通过颜色和图标直观显示状态
3. **自动更新**：无需刷新页面，时间状态自动更新
4. **友好提醒**：明确告知服务时间和建议
5. **个性化设计**：美观的动画和视觉效果
6. **突出显示**：重要信息加粗显示，操作提示明确

### 测试场景
1. **服务时间外测试**：在英国时间 21:30 至次日 04:30 期间访问页面
2. **服务时间内测试**：在英国时间 04:30–21:30 期间访问页面
3. **时间边界测试**：在 04:30 和 21:30 的边界时间测试
4. **自动更新测试**：观察每分钟的时间更新
5. **动画效果测试**：验证各种动画效果是否正常