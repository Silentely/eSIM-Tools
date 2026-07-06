/**
 * Sentry 前端监控初始化模块 (CDN 版本)
 *
 * 职责：
 * - 环境检测（仅生产环境启用）
 * - 错误追踪和性能监控
 * - 敏感数据过滤
 * - 用户上下文管理
 *
 * @module sentry-init
 *
 * 使用方式：
 * 1. 在 HTML <head> 中加载 Sentry CDN (由 sentry-loader.js 自动处理)
 * 2. 导入此模块进行初始化
 */

// ===================================
// 全局错误拦截（在 Sentry 之前）
// ===================================

const EXTENSION_NOISE_STORE_KEY = '__sentryExtensionNoiseStats';
const EXTENSION_NOISE_SAMPLE_LIMIT = 20;
const EXTENSION_ERROR_KEYWORDS = [
  'cannot redefine property',
  'redefine property',
  'defineproperty',
  'object.defineproperty',
  'ethereum',
  'chrome-extension://',
  'moz-extension://',
  'extensions/',
  'inpage.js',
  'tronlink',
  'backpack',
  'metamask',
  'wallet must has at least one account',
  'wallet must have at least one account',
  'webkit-masked-url://',
  'autofillfielddata.autocompletetype.includes',
  'can\'t find variable: currentinset',
  'can\'t find variable: config',
  'error invoking post',
  'method not found',
  'swal',
];

function toLowerSafe(value) {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
}

function includesExtensionKeyword(value) {
  const normalized = toLowerSafe(value);
  if (!normalized) return false;
  return EXTENSION_ERROR_KEYWORDS.some(keyword => normalized.includes(keyword));
}

function isExtensionProviderConflict({
  message = '',
  stack = '',
  filename = '',
  functionName = '',
  mechanismType = '',
} = {}) {
  return includesExtensionKeyword(message) ||
    includesExtensionKeyword(stack) ||
    includesExtensionKeyword(filename) ||
    includesExtensionKeyword(functionName) ||
    includesExtensionKeyword(mechanismType);
}

function isGenericObjectRejectionException(exception = {}) {
  const mechanismType = toLowerSafe(exception?.mechanism?.type || '');
  if (mechanismType !== 'onunhandledrejection') return false;

  const exceptionValue = toLowerSafe(exception?.value || '');
  return exceptionValue.includes('object captured as promise rejection with keys') ||
    exceptionValue.includes('non-error promise rejection captured with keys');
}

function collectEventSearchableText(event) {
  const MAX_DEPTH = 4;
  const MAX_CHUNKS = 160;
  const chunks = [];
  const seen = new Set();

  function pushChunk(value) {
    if (value === null || value === undefined) return;
    if (chunks.length >= MAX_CHUNKS) return;
    chunks.push(String(value));
  }

  function walk(value, depth = 0) {
    if (value === null || value === undefined) return;
    if (chunks.length >= MAX_CHUNKS) return;
    if (depth > MAX_DEPTH) return;

    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
      pushChunk(value);
      return;
    }

    if (valueType !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach(item => walk(item, depth + 1));
      return;
    }

    Object.keys(value).forEach((key) => {
      if (chunks.length >= MAX_CHUNKS) return;
      // 优先采集错误链路核心字段，避免遍历过深影响性能
      if ([
        'message',
        'value',
        'type',
        'reason',
        'originalException',
        'mechanism',
        'exception',
        'extra',
        'breadcrumbs',
        'data',
        'filename',
        'function',
      ].includes(key)) {
        walk(value[key], depth + 1);
        return;
      }

      if (depth < 2) {
        walk(value[key], depth + 1);
      }
    });
  }

  walk(event, 0);
  return chunks.join('\n');
}

function recordExtensionNoise(source, payload = {}) {
  try {
    const store = window[EXTENSION_NOISE_STORE_KEY] || { count: 0, samples: [] };
    if (!Array.isArray(store.samples)) {
      store.samples = [];
    }

    store.count += 1;
    store.lastSource = source;
    store.lastSeenAt = new Date().toISOString();

    const sample = {
      source,
      message: toLowerSafe(payload.message).substring(0, 160),
      filename: toLowerSafe(payload.filename).substring(0, 240),
      mechanismType: toLowerSafe(payload.mechanismType),
      timestamp: store.lastSeenAt,
    };

    if (sample.message || sample.filename) {
      if (store.samples.length >= EXTENSION_NOISE_SAMPLE_LIMIT) {
        store.samples.shift();
      }
      store.samples.push(sample);
    }

    window[EXTENSION_NOISE_STORE_KEY] = store;

    if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('sentry-extension-noise-blocked', {
        detail: {
          count: store.count,
          lastSource: source,
        },
      }));
    }
  } catch (_) {}
}

if (typeof window !== 'undefined' && !window.getSentryExtensionNoiseStats) {
  window.getSentryExtensionNoiseStats = () => {
    const store = window[EXTENSION_NOISE_STORE_KEY];
    if (!store || typeof store !== 'object') {
      return { count: 0, samples: [] };
    }
    return store;
  };
}

/**
 * 在 Sentry 捕获之前拦截浏览器扩展相关的错误
 * 这是最强的防护层，确保扩展错误不会污染 Sentry 日志
 */
if (typeof window !== 'undefined') {
  // 拦截 unhandledrejection 事件
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;

    let message = '';
    let stack = '';
    let allReasonText = '';

    if (typeof reason === 'string') {
      message = reason;
      allReasonText = reason;
    } else if (reason && typeof reason === 'object') {
      message = reason.message || reason.toString();
      stack = reason.stack || '';
      // 收集 reason 对象的所有属性值，用于检测钱包扩展冲突
      // 钱包扩展可能 reject {code: 4001, message: "wallet must has at least one account"} 这样的对象
      const reasonValues = [];
      try {
        Object.keys(reason).forEach(key => {
          const val = reason[key];
          if (val !== null && val !== undefined) {
            reasonValues.push(String(val));
          }
        });
      } catch (e) {
        // 忽略遍历错误
      }
      allReasonText = reasonValues.join(' ');
    }

    // 收集 reason 对象所有属性值（含嵌套），用于扩展关键词检测
    if (reason && typeof reason === 'object' && !allReasonText) {
      try {
        // 优先用 JSON.stringify 序列化整个对象（含嵌套结构）
        // 钱包扩展错误常返回嵌套对象如 { error: { message: "..." } }
        allReasonText = JSON.stringify(reason);
      } catch (_) {
        // 循环引用等情况降级到浅层遍历
        try {
          const reasonValues = [];
          Object.keys(reason).forEach(key => {
            const val = reason[key];
            if (val !== null && val !== undefined) {
              reasonValues.push(String(val));
            }
          });
          allReasonText = reasonValues.join(' ');
        } catch (_) {}
      }
    }

    // 先检查 message 和 stack 是否包含扩展关键词
    let shouldBlock = isExtensionProviderConflict({
      message,
      stack,
      mechanismType: 'onunhandledrejection',
    });

    // 额外检查 reason 对象所有属性值（含嵌套）是否包含扩展关键词
    if (!shouldBlock && allReasonText) {
      shouldBlock = includesExtensionKeyword(allReasonText);
    }

    if (!shouldBlock && event.promise) {
      shouldBlock = includesExtensionKeyword(event.promise);
    }

    if (shouldBlock) {
      event.preventDefault();
      recordExtensionNoise('init-unhandledrejection', {
        message,
        mechanismType: 'onunhandledrejection',
      });
      console.debug('[Sentry Filter] 已拦截浏览器扩展错误:', {
        message: toLowerSafe(message).substring(0, 100),
        type: typeof reason,
        hasStack: !!stack,
      });
    }
  }, true);  // 使用捕获阶段，确保最早执行

  // 拦截 error 事件
  window.addEventListener('error', (event) => {
    const error = event.error;
    let message = event.message || '';
    let stack = '';
    const filename = event.filename || '';

    if (error) {
      if (typeof error === 'string') {
        message = error;
      } else if (typeof error === 'object') {
        message = error.message || message || error.toString();
        stack = error.stack || '';
      }
    }

    if (isExtensionProviderConflict({ message, stack, filename })) {
      event.preventDefault();
      recordExtensionNoise('init-error', { message, filename });
      console.debug('[Sentry Filter] 已拦截浏览器扩展错误:', {
        message: toLowerSafe(message).substring(0, 100),
        filename,
        hasStack: !!stack,
      });
    }
  }, true);  // 使用捕获阶段，确保最早执行
}

// ===================================
// 环境检测
// ===================================

/**
 * 检测是否为开发环境
 */
const isDev = (() => {
  if (typeof window === 'undefined') return true;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
})();

// ===================================
// 错误反馈弹窗冷却机制
// 避免同一错误或短时间内反复弹窗打扰用户
// ===================================

const REPORT_DIALOG_COOLDOWN_MS = 60000; // 60 秒冷却时间
let lastReportDialogTime = 0;
let lastReportDialogFingerprint = '';

/**
 * 判断是否应该显示反馈弹窗
 * @param {Object} event - Sentry 事件对象
 * @returns {{ shouldShow: boolean, fingerprint: string }}
 */
function shouldShowReportDialog(event) {
  const empty = { shouldShow: false, fingerprint: '' };

  // 空事件防御
  if (!event || typeof event !== 'object') return empty;

  // 仅生产环境弹窗
  if (isDev) return empty;

  // 仅对异常事件弹窗（captureMessage 等不弹）
  if (!event.exception || !event.exception.values || !event.exception.values.length) {
    return empty;
  }

  // 生成错误指纹：取第一个异常的 type + value 组合
  const firstException = event.exception.values[0];
  const fingerprint = (firstException.type || '') + ':' + (firstException.value || '');

  // 冷却检查：避免短时间内反复弹窗
  const now = Date.now();
  if (now - lastReportDialogTime < REPORT_DIALOG_COOLDOWN_MS) {
    return { shouldShow: false, fingerprint };
  }

  // 同一错误不重复弹窗
  if (fingerprint === lastReportDialogFingerprint) {
    return { shouldShow: false, fingerprint };
  }

  return { shouldShow: true, fingerprint };
}

// ===================================
// Sentry 配置
// ===================================

// 从 window 获取配置（由 HTML 中的内联脚本设置）
const SENTRY_DSN = window.SENTRY_DSN || '';
const SENTRY_ENVIRONMENT = window.SENTRY_ENVIRONMENT || 'production';
const SENTRY_RELEASE = window.SENTRY_RELEASE || 'esim-tools@unknown';

// ===================================
// Sentry 初始化
// ===================================

let sentryInitialized = false;

/**
 * 初始化 Sentry（在 Sentry SDK 加载后调用）
 */
function initSentry() {
  if (isDev) {
    console.log('[Sentry] 开发环境，使用 Mock 模式');
    window.Sentry = SentryMock;
    return;
  }

  if (!window.Sentry) {
    console.warn('[Sentry] SDK 未加载，跳过初始化');
    window.Sentry = SentryMock;
    return;
  }

  if (!SENTRY_DSN) {
    console.warn('[Sentry] DSN 未配置，跳过初始化');
    window.Sentry = SentryMock;
    return;
  }

  try {
    window.Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,

      // 性能监控
      integrations: [
        window.Sentry.browserTracingIntegration({
          traceFetch: true,
          traceXHR: true,
          enableLongTask: true,
        }),
        // Session Replay - 记录用户操作以重现错误场景
        window.Sentry.replayIntegration({
          maxReplayDuration: 60000,
          maskAllText: true,
          maskAllInputs: true,
        }),
        // User Feedback Widget - 用户随时可提交反馈
        window.Sentry.feedbackIntegration({
          colorScheme: 'system',
          enableScreenshot: false, // 禁用截图以避免泄露 eSIM 凭据（QR/LPA/激活码）
          triggerLabel: '反馈',
          formTitle: '发送反馈',
          submitButtonLabel: '提交',
          cancelButtonLabel: '取消',
          nameLabel: '名称',
          emailLabel: '邮箱',
          messageLabel: '描述',
          successMessageText: '感谢您的反馈！',
        }),
      ],
      tracesSampleRate: 0.1,

      // 追踪传播目标 - 指定哪些请求应该添加追踪头
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/esim\.cosr\.eu\.org/,
        /^https:\/\/.*\.giffgaff\.com/,
        /^https:\/\/.*\.simyo\.nl/,
        /^https:\/\/qrcode\.show/,
        /^https:\/\/api\.qrserver\.com/,
      ],
      // Session Replay 采样率
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      // 错误采样率
      sampleRate: 1.0,

      // 错误过滤 - 仅过滤浏览器扩展和已知噪音
      ignoreErrors: [
        // 浏览器扩展冲突（必须过滤）
        /Cannot redefine property:? ethereum/i,
        /Cannot redefine property/i,
        /redefine property/i,
        /Object\.defineProperty/i,
        /ethereum/i,
        /chrome-extension/i,
        /moz-extension/i,
        /extensions\//i,
        /inpage\.js/i,
        /tronlink/i,
        /backpack/i,
        /metamask/i,
        /wallet must (?:has|have) at least one account/i,
        /webkit-masked-url/i,
        /autofillFieldData\.autoCompleteType\.includes/i,
        /Can't find variable: currentInset/i,
        /Can't find variable: CONFIG/i,
        // Android WebView / 浏览器注入脚本噪音
        /Error invoking post/i,
        /Method not found/i,
        // 已知浏览器噪音（保留）
        'ResizeObserver loop',
        'Non-Error promise rejection',
        /AbortError/,
        // 第三方脚本噪音
        /turnstile/i,
        // 浏览器扩展注入的 SweetAlert 冲突（t.swal=e() 模式）
        /t\.swal=e\(\)/i,
        // Google Tag Manager 噪音 (ESIM-TOOLS-18)
        /gtag\/js/,
        /gtm\.js/,
        /Unexpected token '<'/,
        // Mobile Safari fetch 网络错误噪音（ESIM-TOOLS-1G）
        /Load failed/,
        // 浏览器扩展注入代码 .split() 调用失败噪音（ESIM-TOOLS-1H）
        /Cannot read properties of undefined \(reading 'split'\)/,
      ],

      denyUrls: [
        // 浏览器扩展
        /extensions\//i,
        /^chrome:\/\//i,
        /^moz-extension:\/\//i,
        /^chrome-extension:\/\//i,
        /^webkit-masked-url:\/\//i,
      ],

      // 敏感数据过滤 + 诊断日志
      beforeSend(event) {
        // 1. 仅过滤浏览器扩展错误（更精确的匹配）
        if (event.exception?.values) {
          for (const exception of event.exception.values) {
            const mechanismType = exception?.mechanism?.type || '';

            // 仅在堆栈帧中明确包含扩展路径时才过滤
            const frames = exception.stacktrace?.frames || [];
            const hasExtensionFrame = frames.some(frame => {
              const filename = frame.filename || '';
              return /chrome-extension:\/\//.test(filename) ||
                     /moz-extension:\/\//.test(filename) ||
                     /webkit-masked-url:\/\//.test(filename);
            });

            if (hasExtensionFrame) {
              recordExtensionNoise('init-beforeSend-extension-frame', {
                message: exception.value,
                mechanismType,
              });
              return null;
            }

            // 过滤非 Error 类型的 rejection 对象（如 { code, message }）
            // 这类对象通常是 API 错误响应被直接 reject，不属于代码 bug
            if (mechanismType === 'onunhandledrejection' &&
                (exception.value || '').includes('object captured as promise rejection with keys')) {
              return null;
            }
          }
        }

        // 1b. 过滤 extra.__serialized__ 中的钱包扩展噪音
        // 非 Error rejection 对象的原始内容存储在 extra.__serialized__，
        // ignoreErrors 正则只能匹配 exception.value（已被 SDK 序列化为通用描述），
        // 无法匹配到原始 rejection 内容，因此需要在此处额外检查
        if (event.extra?.__serialized__) {
          const serialized = typeof event.extra.__serialized__ === 'string'
            ? event.extra.__serialized__
            : JSON.stringify(event.extra.__serialized__);
          if (includesExtensionKeyword(serialized)) {
            recordExtensionNoise('init-beforeSend-serialized', {
              message: serialized.substring(0, 160),
              mechanismType: 'onunhandledrejection',
            });
            return null;
          }
        }

        // 2. 脱敏 URL 中的敏感查询参数 + 删除敏感请求数据
        function sanitizeQueryString(url) {
          if (!url) return url;
          const sensitiveParams = ['token', 'key', 'password', 'code', 'state', 'access_token', 'refresh_token', 'auth', 'secret'];
          try {
            const urlObj = new URL(url, window.location.origin);
            // 先收集所有键再遍历，避免迭代时修改 searchParams 底层列表
            const keys = Array.from(urlObj.searchParams.keys());
            keys.forEach(key => {
              if (sensitiveParams.includes(key.toLowerCase())) {
                urlObj.searchParams.set(key, '***');
              }
            });
            return urlObj.toString();
          } catch (e) {
            return url.replace(/([?&])(token|key|password|code|state|access_token|refresh_token|auth|secret)=[^&]*/gi, '$1$2=***');
          }
        }

        if (event.request) {
          if (event.request.query_string) {
            if (typeof event.request.query_string === 'string') {
              event.request.query_string = event.request.query_string
                .replace(/(token|key|password|code|state|access_token|refresh_token|auth|secret)=[^&]*/gi, '$1=***');
            } else if (typeof event.request.query_string === 'object') {
              const sensitiveParams = ['token', 'key', 'password', 'code', 'state', 'access_token', 'refresh_token', 'auth', 'secret'];
              // Case-insensitive matching while preserving original keys
              for (const [key] of Object.entries(event.request.query_string)) {
                if (sensitiveParams.includes(key.toLowerCase())) {
                  event.request.query_string[key] = '***';
                }
              }
            }
          }
          if (event.request.url) {
            event.request.url = sanitizeQueryString(event.request.url);
          }
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['x-esim-key'];
            delete event.request.headers['cookie'];
          }
        }

        // 3. 弹窗决策：在脱敏前基于原始异常值计算指纹，避免脱敏后不同错误产生相同指纹
        // 注：在 beforeSend 中触发 UI 交互是刻意设计，因为需要 event_id 关联反馈
        let reportCheck = { shouldShow: false, fingerprint: '' };
        if (event.exception?.values) {
          // 保存原始异常值用于指纹计算
          const originalValues = event.exception.values.map(e => e.value);
          reportCheck = shouldShowReportDialog(event);
          // 恢复原始值，确保后续脱敏基于原始数据
          event.exception.values.forEach((e, i) => { e.value = originalValues[i]; });
        }

        // 4. 脱敏异常消息中的敏感信息
        if (event.exception?.values) {
          event.exception.values.forEach(exception => {
            if (exception.value) {
              exception.value = exception.value
                .replace(/token[=:]\s*[^\s,]+/gi, 'token=***')
                .replace(/key[=:]\s*[^\s,]+/gi, 'key=***')
                .replace(/password[=:]\s*[^\s,]+/gi, 'password=***')
                .replace(/cookie[=:]\s*[^\s,]+/gi, 'cookie=***')
                .replace(/code[=:]\s*[^\s,]+/gi, 'code=***')
                .replace(/state[=:]\s*[^\s,]+/gi, 'state=***')
                .replace(/access_token[=:]\s*[^\s,]+/gi, 'access_token=***')
                .replace(/refresh_token[=:]\s*[^\s,]+/gi, 'refresh_token=***');
            }
          });
        }

        // 5. 错误后自动弹出反馈对话框（仅生产环境、异常事件、冷却期内不重复）
        if (reportCheck.shouldShow && event.event_id) {
          const eventId = event.event_id;
          const fingerprint = reportCheck.fingerprint;
          // 立即更新冷却状态，避免多个错误同时触发弹窗
          lastReportDialogFingerprint = fingerprint;
          lastReportDialogTime = Date.now();
          // 延迟弹窗，确保 Sentry 事件已发送完成
          setTimeout(function() {
            try {
              showReportDialog({ eventId: eventId, title: '问题反馈', subtitle: '抱歉，发生了错误', subtitle2: '您的反馈将帮助我们改进服务', labelName: '名称', labelEmail: '邮箱', labelComments: '问题描述（选填）', labelClose: '关闭', labelSubmit: '提交反馈', successMessage: '感谢您的反馈！' });
            } catch (e) {
              // 弹窗失败时回滚冷却状态，允许后续重试
              lastReportDialogFingerprint = '';
              lastReportDialogTime = 0;
            }
          }, 500);
        }

        return event;
      },
    });

    sentryInitialized = true;
    console.log('[Sentry] 前端初始化成功');
  } catch (error) {
    console.error('[Sentry] 初始化失败:', error);
    window.Sentry = SentryMock;
  }
}

// ===================================
// Mock 对象（开发环境使用）
// ===================================

const SentryMock = {
  init: () => {},
  captureException: (error) => {
    console.error('[Sentry Dev] Exception:', error);
  },
  captureMessage: (message, level) => {
    console.log(`[Sentry Dev] ${level || 'info'}:`, message);
  },
  addBreadcrumb: () => {},
  setUser: () => {},
  setTag: () => {},
  setContext: () => {},
  withScope: (callback) => callback({ setContext: () => {}, setTag: () => {} }),
  browserTracingIntegration: () => ({}),
  feedbackIntegration: () => ({}),
  replayIntegration: () => ({}),
  showReportDialog: () => {},
  lastEventId: () => null,
};

// ===================================
// 自动初始化
// ===================================

// 如果 Sentry SDK 已加载，立即初始化
if (typeof window !== 'undefined') {
  if (window.Sentry && window.Sentry.init) {
    initSentry();
  } else {
    // 等待 SDK 加载
    window.addEventListener('sentry-sdk-loaded', initSentry);
    // 设置超时回退
    setTimeout(() => {
      if (!sentryInitialized) {
        console.warn('[Sentry] SDK 加载超时，使用 Mock 模式');
        window.Sentry = SentryMock;
      }
    }, 5000);
  }
}

// ===================================
// 导出 Helper 函数
// ===================================

/**
 * 获取 Sentry 实例
 */
export function getSentry() {
  return window.Sentry || SentryMock;
}

/**
 * 设置用户上下文
 */
export function setUser(userId, email) {
  getSentry().setUser({ id: userId, email });
}

/**
 * 清除用户上下文
 */
export function clearUser() {
  getSentry().setUser(null);
}

/**
 * 手动捕获异常
 */
export function captureException(error, context) {
  const sentry = getSentry();
  if (context) {
    sentry.withScope(scope => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      sentry.captureException(error);
    });
  } else {
    sentry.captureException(error);
  }
}

/**
 * 手动捕获消息
 */
export function captureMessage(message, level = 'info') {
  getSentry().captureMessage(message, level);
}

/**
 * 测试 Sentry 是否正常工作
 */
export function testSentry() {
  const sentry = getSentry();
  console.log('[Sentry Test] 开始测试...');
  console.log('[Sentry Test] SDK 已加载:', !!window.Sentry);
  console.log('[Sentry Test] 已初始化:', sentryInitialized);
  console.log('[Sentry Test] 开发环境:', isDev);
  console.log('[Sentry Test] DSN 已配置:', !!SENTRY_DSN);

  if (sentryInitialized && !isDev) {
    sentry.captureMessage('Sentry 测试消息 - 前端集成正常', 'info');
    console.log('[Sentry Test] ✅ 已发送测试消息到 Sentry');
  } else {
    console.log('[Sentry Test] ⚠️ Mock 模式，消息不会发送到 Sentry');
    sentry.captureMessage('测试消息 (Mock)', 'info');
  }
}

/**
 * 显示用户反馈对话框
 * 当发生错误时，允许用户主动报告问题详情
 */
export function showReportDialog(options = {}) {
  const sentry = getSentry();
  if (sentry.showReportDialog) {
    sentry.showReportDialog({
      eventId: options.eventId || lastEventId(),
      title: options.title || '报告问题',
      subtitle: options.subtitle || '告诉我们发生了什么',
      subtitle2: options.subtitle2 || '您的反馈将帮助我们改进',
      labelName: options.labelName || '名称',
      labelEmail: options.labelEmail || '邮箱',
      labelComments: options.labelComments || '问题描述',
      labelClose: options.labelClose || '关闭',
      labelSubmit: options.labelSubmit || '提交反馈',
      successMessage: options.successMessage || '感谢您的反馈！',
      ...options,
    });
  }
}

/**
 * 获取上次错误事件 ID
 */
function lastEventId() {
  const sentry = getSentry();
  return sentry.lastEventId ? sentry.lastEventId() : null;
}

/**
 * 获取 Sentry 健康状态
 */
export function getSentryHealth() {
  return {
    sdkLoaded: !!window.Sentry && window.Sentry !== SentryMock,
    initialized: sentryInitialized,
    isDev: isDev,
    dsnConfigured: !!SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    extensionNoiseStats: typeof window !== 'undefined' && window.getSentryExtensionNoiseStats
      ? window.getSentryExtensionNoiseStats()
      : { count: 0, samples: [] },
  };
}

// 暴露测试函数到全局
if (typeof window !== 'undefined') {
  window.testSentry = testSentry;
  window.getSentryHealth = getSentryHealth;
  window.showReportDialog = showReportDialog;
}

export default {
  getSentry,
  setUser,
  clearUser,
  captureException,
  captureMessage,
  testSentry,
  showReportDialog,
  getSentryHealth,
};
