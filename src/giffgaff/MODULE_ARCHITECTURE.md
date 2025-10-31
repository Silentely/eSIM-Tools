# Giffgaff eSIM 工具 - 模块架构说明

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    giffgaff_modular.html                    │
│                     (HTML结构层)                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CSS样式层                               │
├─────────────────────────────────────────────────────────────┤
│  • giffgaff-base.css         (基础样式)                     │
│  • giffgaff-components.css   (组件样式)                     │
│  • giffgaff-service-time.css (服务时间)                     │
│  • giffgaff-animations.css   (动画效果)                     │
│  • giffgaff-responsive.css   (响应式)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   giffgaff-app.js                           │
│                  (应用主入口)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌───────────────────────┐       ┌───────────────────────┐
│   核心服务层          │       │   UI控制层            │
├───────────────────────┤       ├───────────────────────┤
│ • oauth-handler.js    │       │ • ui-controller.js    │
│ • cookie-handler.js   │       │                       │
│ • mfa-handler.js      │       └───────────────────────┘
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
- Cookie管理

**依赖：** 无

**被依赖：** 所有业务模块

```javascript
// 状态结构
{
    accessToken: string,
    codeVerifier: string,
    cookie: string,
    emailCodeRef: string,
    emailSignature: string,
    memberId: string,
    memberName: string,
    phoneNumber: string,
    esimSSN: string,
    esimActivationCode: string,
    esimDeliveryStatus: string,
    lpaString: string,
    isDeviceChange: boolean,
    currentStep: number
}
```

#### 2. api-config.js
**职责：** 集中管理API配置

**提供：**
- OAuth配置
- API端点定义
- GraphQL查询模板

**依赖：** utils.js (环境检测)

**被依赖：** 所有服务模块

#### 3. utils.js
**职责：** 通用工具函数

**提供：**
- PKCE参数生成
- 服务时间检查
- 剪贴板操作
- Toast通知
- 环境检测

**依赖：** 无

**被依赖：** 所有模块

### 第二层：核心服务层

#### 4. oauth-handler.js
**职责：** OAuth 2.0 PKCE认证流程

**核心方法：**
- `startOAuthLogin()` - 启动OAuth登录
- `processCallback()` - 处理OAuth回调

**依赖：**
- state-manager.js
- api-config.js
- utils.js

**数据流：**
```
用户点击登录
    ↓
生成PKCE参数 (utils)
    ↓
保存到状态 (state-manager)
    ↓
打开授权页面
    ↓
用户授权并获取回调URL
    ↓
解析code和state
    ↓
交换访问令牌 (api-config)
    ↓
保存令牌 (state-manager)
```

#### 5. cookie-handler.js
**职责：** Cookie验证和生命周期管理

**核心方法：**
- `verifyCookie()` - 验证Cookie有效性
- `checkCookieValidity()` - 定期检查
- `startValidityMonitor()` - 启动监控
- `stopValidityMonitor()` - 停止监控
- `handleCookieExpired()` - 处理过期

**依赖：**
- state-manager.js
- api-config.js

**监控机制：**
```
Cookie验证成功
    ↓
启动定时器（5分钟间隔）
    ↓
定期调用验证API
    ↓
如果401 → 触发过期处理
    ↓
清除状态并通知UI
```

#### 6. mfa-handler.js
**职责：** 多因素认证流程

**核心方法：**
- `sendMFAChallenge()` - 发送验证码
- `validateMFACode()` - 验证验证码
- `sendSimSwapMFAChallenge()` - SIM交换验证码

**依赖：**
- state-manager.js
- api-config.js

**验证流程：**
```
发送验证码请求
    ↓
保存ref到状态
    ↓
用户输入验证码
    ↓
验证并获取签名
    ↓
保存签名到状态
```

#### 7. esim-service.js
**职责：** eSIM相关的所有业务操作

**核心方法：**
- `getMemberInfo()` - 获取会员信息
- `reserveESim()` - 预订eSIM
- `swapSim()` - 交换SIM卡
- `getESimDownloadToken()` - 获取LPA
- `autoActivateESim()` - 自动激活
- `smsActivateFlow()` - 完整SMS激活流程

**依赖：**
- state-manager.js
- api-config.js

**SMS激活完整流程：**
```
发送短信验证码
    ↓
验证短信验证码 → 获取签名
    ↓
预订eSIM → 获取激活码和SSN
    ↓
执行SIM交换 → 激活新eSIM
    ↓
轮询获取LPA → 生成二维码
```

### 第三层：UI控制层

#### 8. ui-controller.js
**职责：** UI状态管理和用户交互

**核心方法：**
- `showStatus()` - 显示状态消息
- `updateSteps()` - 更新步骤指示器
- `showSection()` - 切换步骤
- `updateStatusPanel()` - 更新状态面板
- `showMemberInfo()` - 显示会员信息
- `showESIMInfoAndGuide()` - 显示eSIM信息
- `generateQRCode()` - 生成二维码
- `showESimResult()` - 显示最终结果

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

#### 9. giffgaff-app.js
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
创建GiffgaffApp实例
    ↓
订阅状态变化
    ↓
绑定所有事件监听器
    ↓
初始化服务时间检查
    ↓
恢复会话（如有）
    ↓
更新UI显示
    ↓
应用就绪
```

## 🔄 数据流向

### 典型操作流程示例

#### OAuth登录流程
```
用户点击"开始OAuth登录"
    ↓
giffgaff-app.handleOAuthLogin()
    ↓
oauth-handler.startOAuthLogin()
    ├─→ utils.generateCodeVerifier()
    ├─→ utils.generateCodeChallenge()
    └─→ state-manager.set('codeVerifier', ...)
    ↓
打开授权页面
    ↓
用户输入回调URL
    ↓
giffgaff-app.handleOAuthCallback()
    ↓
oauth-handler.processCallback()
    ├─→ 解析code和state
    ├─→ 从state-manager恢复verifier
    ├─→ 调用token交换API (api-config)
    └─→ state-manager.set('accessToken', ...)
    ↓
ui-controller.showSection(2)
```

#### 短信激活流程
```
用户点击"短信验证码激活"
    ↓
giffgaff-app.handleSmsSend()
    ↓
mfa-handler.sendSimSwapMFAChallenge()
    ├─→ 调用GraphQL API (api-config)
    └─→ state-manager.set('emailCodeRef', ...)
    ↓
用户输入验证码
    ↓
giffgaff-app.handleSmsVerify()
    ↓
esim-service.smsActivateFlow()
    ├─→ mfa-handler.validateMFACode()
    ├─→ esim-service.reserveESim()
    ├─→ esim-service.swapSim()
    └─→ esim-service.waitAndGetLPA()
    ↓
ui-controller.showESimResult()
```

## 🎯 设计模式应用

### 1. 单例模式 (Singleton)
所有模块都导出单例实例，确保全局唯一：
```javascript
export const stateManager = new StateManager();
export const uiController = new UIController();
// ...
```

### 2. 观察者模式 (Observer)
状态管理使用观察者模式通知UI更新：
```javascript
stateManager.subscribe((state) => {
    uiController.updateStatusPanel();
});
```

### 3. 策略模式 (Strategy)
不同的登录方式（OAuth/Cookie）使用不同的处理器

### 4. 外观模式 (Facade)
`giffgaff-app.js` 作为外观，简化模块间交互

## 🔍 关键技术点

### ES6模块系统
```javascript
// 导出
export class MyClass { }
export const myInstance = new MyClass();
export function myFunction() { }

// 导入
import { myInstance, myFunction } from './module.js';
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

## 📊 性能优化点

### 1. 资源加载
- CSS文件可并行加载
- JavaScript模块按需加载
- 预连接关键域名

### 2. 代码分割
- 每个模块独立文件
- 浏览器可缓存单个模块
- 修改一个模块不影响其他缓存

### 3. 运行时优化
- 减少全局变量
- 事件委托减少监听器
- 防抖和节流（如需要）

## 🛡️ 错误处理策略

### 分层错误处理

```
用户操作
    ↓
giffgaff-app (捕获并显示用户友好消息)
    ↓
服务模块 (捕获并转换API错误)
    ↓
API调用 (原始错误)
```

### 错误类型

1. **网络错误** - 显示"网络连接失败"
2. **API错误** - 显示具体错误信息
3. **验证错误** - 显示表单验证提示
4. **状态错误** - 引导用户回到正确步骤

## 🔐 安全考虑

### 1. 敏感数据处理
- Access Token仅存储在内存和localStorage
- Cookie不在代码中硬编码
- 定期检查Cookie有效性

### 2. XSS防护
- 使用 `textContent` 而非 `innerHTML`（除非必要）
- CSP策略限制脚本来源
- 用户输入验证

### 3. CSRF防护
- 使用PKCE流程
- State参数验证
- Turnstile人机验证

## 📈 扩展性设计

### 添加新的认证方式

1. 创建新的handler模块：
```javascript
// new-auth-handler.js
export class NewAuthHandler {
    async authenticate() {
        // 实现认证逻辑
    }
}
export const newAuthHandler = new NewAuthHandler();
```

2. 在 `giffgaff-app.js` 中集成：
```javascript
import { newAuthHandler } from './modules/new-auth-handler.js';

bindNewAuthMethod() {
    element.addEventListener('click', async () => {
        const result = await newAuthHandler.authenticate();
        // 处理结果
    });
}
```

### 添加新的API端点

1. 在 `api-config.js` 中添加：
```javascript
export function getApiEndpoints() {
    return {
        // 现有端点...
        newEndpoint: "/bff/new-endpoint"
    };
}
```

2. 在对应服务模块中使用：
```javascript
async callNewEndpoint() {
    const response = await fetch(this.apiEndpoints.newEndpoint, {
        // 请求配置
    });
    return await response.json();
}
```

## 🧪 测试建议

### 单元测试示例

```javascript
// state-manager.test.js
import { StateManager } from './state-manager.js';

describe('StateManager', () => {
    let manager;
    
    beforeEach(() => {
        manager = new StateManager();
        localStorage.clear();
    });
    
    test('应该正确保存和恢复会话', () => {
        manager.setState({ accessToken: 'test-token' });
        manager.saveSession();
        
        const newManager = new StateManager();
        const restored = newManager.loadSession();
        
        expect(restored).toBe(true);
        expect(newManager.get('accessToken')).toBe('test-token');
    });
    
    test('应该在超时后清除会话', () => {
        manager.setState({ accessToken: 'test-token' });
        manager.saveSession();
        
        // 模拟超时
        const sessionData = JSON.parse(localStorage.getItem('giffgaff_session'));
        sessionData.timestamp = Date.now() - (3 * 60 * 60 * 1000); // 3小时前
        localStorage.setItem('giffgaff_session', JSON.stringify(sessionData));
        
        const newManager = new StateManager();
        const restored = newManager.loadSession();
        
        expect(restored).toBe(false);
    });
});
```

### 集成测试示例

```javascript
// oauth-flow.test.js
import { oauthHandler } from './oauth-handler.js';
import { stateManager } from './state-manager.js';

describe('OAuth Flow', () => {
    test('完整OAuth流程', async () => {
        // 1. 启动登录
        const loginResult = await oauthHandler.startOAuthLogin();
        expect(loginResult.success).toBe(true);
        expect(stateManager.get('codeVerifier')).toBeTruthy();
        
        // 2. 模拟回调
        const mockCallback = 'giffgaff://auth/callback/?code=TEST&state=STATE';
        const callbackResult = await oauthHandler.processCallback(mockCallback);
        
        expect(callbackResult.success).toBe(true);
        expect(stateManager.get('accessToken')).toBeTruthy();
    });
});
```

## 📝 代码规范

### 命名约定
- **类名**：PascalCase (`StateManager`)
- **函数名**：camelCase (`getMemberInfo`)
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

### 错误处理
```javascript
try {
    const result = await operation();
    return { success: true, data: result };
} catch (error) {
    console.error('操作失败:', error);
    throw error; // 或返回错误对象
}
```

## 🚀 部署建议

### 生产环境
1. 使用Webpack/Rollup打包所有模块
2. 启用代码压缩和混淆
3. 使用CDN加速静态资源
4. 启用HTTP/2服务器推送

### 开发环境
1. 直接使用ES6模块（无需打包）
2. 启用Source Map调试
3. 使用热重载提升开发效率

---

**文档版本：** 1.0.0  
**最后更新：** 2025-10-31  
**维护者：** eSIM Tools Team