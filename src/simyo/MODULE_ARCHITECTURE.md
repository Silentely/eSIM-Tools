# Simyo eSIM 工具 - 模块架构说明

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    simyo_modular.html                       │
│                     (HTML结构层)                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CSS样式层                               │
├─────────────────────────────────────────────────────────────┤
│  • simyo-base.css         (基础样式)                        │
│  • simyo-components.css   (组件样式)                        │
│  • simyo-animations.css   (动画效果)                        │
│  • simyo-responsive.css   (响应式)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   simyo-app.js                              │
│                  (应用主入口)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌───────────────────────┐       ┌───────────────────────┐
│   核心服务层          │       │   UI控制层            │
├───────────────────────┤       ├───────────────────────┤
│ • auth-handler.js     │       │ • ui-controller.js    │
│ • device-change-      │       │                       │
│   handler.js          │       └───────────────────────┘
│ • esim-service.js     │                   │
└───────────────────────┘                   │
        │                                   │
        └───────────┬───────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      基础设施层                              │
├─────────────────────────────────────────────────────────────┤
│  • state-manager.js    (状态管理)                           │
│  • api-config.js       (API配置)                            │
│  • utils.js            (工具函数)                           │
└─────────────────────────────────────────────────────────────┘
```

## 📦 模块详细说明

### 第一层：基础设施层

#### 1. state-manager.js
**职责：** 应用状态的唯一真实来源

**提供：**
- 状态存储和访问
- 状态持久化（localStorage）
- 状态变更通知（观察者模式）
- 会话管理

**依赖：** 无

**被依赖：** 所有业务模块

```javascript
// 状态结构
{
    sessionToken: string,
    phoneNumber: string,
    password: string,
    activationCode: string,
    validationCode: string,
    isDeviceChange: boolean,
    currentStep: number,
    timestamp: number
}
```

#### 2. api-config.js
**职责：** 集中管理API配置

**提供：**
- Simyo API配置
- API端点定义
- 请求头配置

**依赖：** utils.js (环境检测)

**被依赖：** 所有服务模块

#### 3. utils.js
**职责：** 通用工具函数

**提供：**
- 手机号验证
- 剪贴板操作
- Toast通知
- 环境检测
- Tooltip管理

**依赖：** 无

**被依赖：** 所有模块

### 第二层：核心服务层

#### 4. auth-handler.js
**职责：** 账户登录认证

**核心方法：**
- `login()` - 登录Simyo账户
- `validatePhoneNumber()` - 验证手机号格式

**依赖：**
- state-manager.js
- api-config.js

**数据流：**
```
用户输入账号密码
    ↓
验证手机号格式 (utils)
    ↓
调用登录API (api-config)
    ↓
保存sessionToken (state-manager)
    ↓
触发状态更新
```

#### 5. device-change-handler.js
**职责：** 设备更换完整流程

**核心方法：**
- `applyNewEsim()` - 申请新eSIM
- `sendSmsCode()` - 发送短信验证码
- `verifyCode()` - 验证验证码

**依赖：**
- state-manager.js
- api-config.js

**设备更换流程：**
```
申请新eSIM
    ↓
发送短信验证码（可选）
    ↓
验证验证码
    ↓
更新状态
```

#### 6. esim-service.js
**职责：** eSIM相关的所有业务操作

**核心方法：**
- `getEsim()` - 获取eSIM信息
- `confirmInstall()` - 确认安装
- `generateLPA()` - 生成LPA字符串

**依赖：**
- state-manager.js
- api-config.js

**eSIM获取流程：**
```
调用获取eSIM API
    ↓
解析激活码
    ↓
保存到状态
    ↓
生成LPA字符串
```

### 第三层：UI控制层

#### 7. ui-controller.js
**职责：** UI状态管理和用户交互

**核心方法：**
- `showStatus()` - 显示状态消息
- `updateSteps()` - 更新步骤指示器
- `showSection()` - 切换步骤
- `updateStatusPanel()` - 更新状态面板
- `generateQRCode()` - 生成二维码
- `showDeviceChangeOption()` - 显示设备更换选项

**依赖：**
- state-manager.js

**UI更新机制：**
```
状态变更 (state-manager)
    ↓
触发订阅回调
    ↓
ui-controller.updateStatusPanel()
    ↓
更新DOM显示
```

### 第四层：应用入口层

#### 8. simyo-app.js
**职责：** 应用初始化和事件协调

**核心功能：**
- 初始化所有模块
- 绑定事件监听器
- 协调模块间交互
- 处理用户操作

**初始化流程：**
```
页面加载
    ↓
创建SimyoApp实例
    ↓
订阅状态变化
    ↓
绑定所有事件监听器
    ↓
恢复会话（如有）
    ↓
更新UI显示
    ↓
应用就绪
```

## 🔄 数据流向

### 典型操作流程示例

#### 登录流程
```
用户输入账号密码
    ↓
simyo-app.handleLogin()
    ↓
auth-handler.login()
    ├─→ utils.validatePhoneNumber()
    ├─→ 调用登录API (api-config)
    └─→ state-manager.set('sessionToken', ...)
    ↓
ui-controller.showDeviceChangeOption()
```

#### 设备更换流程
```
用户选择设备更换
    ↓
simyo-app.handleDeviceChange()
    ↓
device-change-handler.applyNewEsim()
    ├─→ 调用API (api-config)
    └─→ state-manager更新状态
    ↓
device-change-handler.sendSmsCode()
    ↓
用户输入验证码
    ↓
device-change-handler.verifyCode()
    ↓
ui-controller.showSection(下一步)
```

#### 获取eSIM流程
```
用户点击获取eSIM
    ↓
simyo-app.handleGetEsim()
    ↓
esim-service.getEsim()
    ├─→ 调用API (api-config)
    ├─→ 解析激活码
    └─→ state-manager保存
    ↓
esim-service.generateLPA()
    ↓
ui-controller.generateQRCode()
```

## 🎯 设计模式应用

### 1. 单例模式 (Singleton)
所有模块都导出单例实例：
```javascript
export const stateManager = new StateManager();
export const uiController = new UIController();
```

### 2. 观察者模式 (Observer)
状态管理使用观察者模式：
```javascript
stateManager.subscribe((state) => {
    uiController.updateStatusPanel();
});
```

### 3. 策略模式 (Strategy)
不同流程（标准/设备更换）使用不同处理器

### 4. 外观模式 (Facade)
`simyo-app.js` 作为外观，简化模块间交互

## 🔍 关键技术点

### ES6模块系统
```javascript
// 导出
export class MyClass { }
export const myInstance = new MyClass();

// 导入
import { myInstance } from './module.js';
```

### 异步处理
所有API调用使用 `async/await`：
```javascript
async handleOperation() {
    try {
        const result = await apiCall();
        // 处理结果
    } catch (error) {
        // 错误处理
    }
}
```

### 状态管理
集中式状态 + 订阅模式：
```javascript
// 更新状态
stateManager.set('key', 'value');

// 自动触发所有订阅者
subscribers.forEach(fn => fn(state));
```

## 📊 与Giffgaff架构的差异

### 相同点
1. 模块分层结构完全一致
2. 状态管理机制相同
3. UI控制模式相同
4. 工具函数复用

### 差异点
1. **认证方式**：Simyo使用简单的账号密码，无需OAuth
2. **设备更换**：Simyo有独立的设备更换流程
3. **API端点**：不同的API服务器和请求格式
4. **验证流程**：Simyo的验证码流程更简单

## 🛡️ 错误处理策略

### 分层错误处理
```
用户操作
    ↓
simyo-app (捕获并显示用户友好消息)
    ↓
服务模块 (捕获并转换API错误)
    ↓
API调用 (原始错误)
```

## 📝 代码规范

### 命名约定
- **类名**：PascalCase (`StateManager`)
- **函数名**：camelCase (`getEsimInfo`)
- **常量**：UPPER_SNAKE_CASE (`SESSION_KEY`)
- **私有方法**：前缀下划线 (`_privateMethod`)

### 注释规范
```javascript
/**
 * 函数功能描述
 * @param {string} param1 - 参数说明
 * @returns {Promise<Object>} 返回值说明
 */
async functionName(param1) {
    // 实现
}
```

## 🚀 渐进式重构计划

### 阶段1：基础设施层
1. ✅ 创建目录结构
2. ⏳ 实现 state-manager.js
3. ⏳ 实现 api-config.js
4. ⏳ 实现 utils.js

### 阶段2：服务层
1. ⏳ 实现 auth-handler.js
2. ⏳ 实现 device-change-handler.js
3. ⏳ 实现 esim-service.js

### 阶段3：UI层
1. ⏳ 实现 ui-controller.js
2. ⏳ 提取CSS到独立文件

### 阶段4：应用层
1. ⏳ 实现 simyo-app.js
2. ⏳ 创建 simyo_modular.html

### 阶段5：测试与优化
1. ⏳ 功能测试
2. ⏳ 性能优化
3. ⏳ 文档完善

---

**文档版本：** 1.0.0  
**创建时间：** 2025-11-01  
**维护者：** eSIM Tools Team