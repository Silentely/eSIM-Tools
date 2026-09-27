/**
 * 本地开发服务器
 * 提供静态文件服务和API代理功能
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

if (typeof global.File === 'undefined') {
  global.File = class File {};
}

const Logger = {
  log: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, process.env.STATIC_ROOT || 'dist');
const INTERNAL_FUNCTION_KEY = process.env.ACCESS_KEY || '';
const { parseOrigins, isAllowedOrigin: _isAllowedOrigin, resolveCorsOrigin: _resolveCorsOrigin } = require('./netlify/functions/_shared/cors');
const configuredOrigins = parseOrigins(process.env.ALLOWED_ORIGIN);
const isLoopbackOrigin = (origin) => {
    if (!origin) return false;
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};
const isAllowedOrigin = (origin) => {
    if (!origin) return false;
    if (_isAllowedOrigin(origin, configuredOrigins)) return true;
    if (process.env.NODE_ENV !== 'production' && isLoopbackOrigin(origin)) return true;
    return false;
};
const getCorsOrigin = (origin) => {
    if (origin && isAllowedOrigin(origin)) return origin;
    return _resolveCorsOrigin(origin, configuredOrigins);
};
// 与 src/simyo/js/modules/client-identity.js 保持同步
const DEFAULT_SIMYO_CLIENT_PLATFORM = 'ios';
const DEFAULT_SIMYO_CLIENT_VERSION = '4.28.0';
const DEFAULT_SIMYO_IOS_VERSION = '18.2';
const DEFAULT_SIMYO_DEVICE_MODEL = 'iPhone12,8';
// 版本号与括号之间为两个空格
const DEFAULT_SIMYO_USER_AGENT =
  `MijnSimyoFT/${DEFAULT_SIMYO_CLIENT_VERSION}  (iOS ${DEFAULT_SIMYO_IOS_VERSION}; ${DEFAULT_SIMYO_DEVICE_MODEL})`;
const crypto = require('crypto');
function getDefaultSimyoDeviceId() {
    if (process.env.SIMYO_DEVICE_ID) return process.env.SIMYO_DEVICE_ID;
    // 进程内稳定 ID，避免每次请求换设备身份
    if (!global.__simyoDeviceId) {
        global.__simyoDeviceId = crypto.randomUUID().toUpperCase();
    }
    return global.__simyoDeviceId;
}

// 启动时环境检查
if (!INTERNAL_FUNCTION_KEY) {
    console.error('❌ ACCESS_KEY 未配置');
    console.error('💡 请在 .env 文件或环境变量中设置 ACCESS_KEY');
    console.error('⚠️  Netlify Functions 将无法正常工作，请修复后重启');
}

if (!process.env.SIMYO_CLIENT_TOKEN) {
    console.warn('⚠️  SIMYO_CLIENT_TOKEN 未配置，Simyo 代理请求可能失败');
    console.warn('💡 请在 .env 文件中设置 SIMYO_CLIENT_TOKEN');
}

if (!fs.existsSync(STATIC_ROOT)) {
    console.warn(`⚠️  静态目录 ${STATIC_ROOT} 不存在，请先运行 npm run build`);
    console.warn('💡 运行: npm run build');
}

const origins = configuredOrigins;
if (origins.allowAll) {
    Logger.warn('⚠️  ALLOWED_ORIGIN 包含通配符(*)，所有来源均可访问。请勿在生产环境使用');
}

// 中间件配置
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://browser.sentry-cdn.com",
                "https://sentry.io",
                "https://*.sentry.io",
                "https://challenges.cloudflare.com",
                "https://www.google.com",
                "https://www.gstatic.com",
                "https://www.googletagmanager.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://fonts.googleapis.com"
            ],
            imgSrc: ["'self'", "data:", "https:"],
            // jsdelivr：Bootstrap source map；sentry-cdn：SDK 回退加载
            connectSrc: [
                "'self'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://browser.sentry-cdn.com",
                "https://www.google-analytics.com",
                "https://analytics.google.com",
                "https://stats.g.doubleclick.net",
                "https://www.googletagmanager.com",
                "https://qrcode.show",
                "https://api.qrserver.com",
                "https://appapi.simyo.nl",
                "https://api.giffgaff.com",
                "https://id.giffgaff.com",
                "https://publicapi.giffgaff.com",
                "https://challenges.cloudflare.com",
                "https://www.google.com",
                "https://www.gstatic.com",
                "https://sentry.io",
                "https://*.sentry.io"
            ],
            fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            frameSrc: ["'self'", "https://challenges.cloudflare.com", "https://www.google.com", "https://*.sentry.io"],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["'self'", "blob:"]
        }
    }
}));

// 仅允许特定来源访问本地API（前端文件本地打开时可能 Origin 为 undefined）
app.use(cors({
    origin: function(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: false
}));
app.use(morgan('combined'));

// 请求体解析中间件（限制 payload 尺寸防止 DoS）
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

const staticMiddleware = express.static(STATIC_ROOT, { fallthrough: true, index: false });

// 限流器配置（符合 CodeQL js/missing-rate-limiting 防御标准）
const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 分钟
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Too many requests, please try again later.' }
});

const staticPageLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Too many requests, please try again later.' }
});

app.use('/bff', apiRateLimiter);
app.use('/.netlify/functions', apiRateLimiter);
app.use('/api', apiRateLimiter);

app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
        return next();
    }
    if (/\.html?$/i.test(req.path)) {
        return next();
    }
    return staticMiddleware(req, res, next);
});

// API路由 - 模拟Netlify Functions
const giffgaffMfaChallenge = require('./netlify/functions/giffgaff-mfa-challenge');
const giffgaffMfaValidation = require('./netlify/functions/giffgaff-mfa-validation');
const giffgaffGraphql = require('./netlify/functions/giffgaff-graphql');
const giffgaffTokenExchange = require('./netlify/functions/giffgaff-token-exchange');
const verifyCookie = require('./netlify/functions/verify-cookie');
const giffgaffSmsActivate = require('./netlify/functions/giffgaff-sms-activate');
const autoActivateEsim = require('./netlify/functions/auto-activate-esim');
const publicConfig = require('./netlify/functions/public-config');
const health = require('./netlify/functions/health');
const notifications = require('./netlify/functions/notifications');

// 包装Netlify Functions为Express路由
function getRouteTargetName(req) {
    const fullPath = (req.baseUrl || '') + (req.path || '');
    return fullPath.split('/').filter(Boolean).pop() || '';
}

function checkBffOriginGate(req, res, targetName) {
    const origin = req.headers.origin;
    const isPublicGet = !origin && req.method === 'GET' && ['public-config', 'health', 'notifications'].includes(targetName);
    if (isPublicGet) return true;
    if (!origin) {
        res.status(403).json({ error: 'Forbidden', message: 'Origin not allowed' });
        return false;
    }
    if (!isAllowedOrigin(origin)) {
        res.status(403).json({ error: 'Forbidden', message: 'Origin not allowed' });
        return false;
    }
    return true;
}

function wrapNetlifyFunction(handler) {
    return async (req, res) => {
        try {
            const targetName = getRouteTargetName(req);
            if (!checkBffOriginGate(req, res, targetName)) {
                return;
            }
            const headers = Object.assign({}, req.headers);
            // 与 Netlify Edge BFF 行为完全同构：剥离客户端传入的 internal keys，强制注入服务端 INTERNAL_FUNCTION_KEY
            delete headers['x-app-key'];
            delete headers['x-esim-key'];
            if (INTERNAL_FUNCTION_KEY) {
                headers['x-esim-key'] = INTERNAL_FUNCTION_KEY;
            }

            let body = null;
            if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined && req.body !== null) {
                body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }

            const event = {
                httpMethod: req.method,
                headers,
                body,
                queryStringParameters: req.query
            };
            const context = {
                clientContext: {},
                functionName: req.path.split('/').pop()
            };

            const result = await handler.handler(event, context);

            res.status(result.statusCode);

            if (result.headers) {
                Object.entries(result.headers).forEach(([key, value]) => {
                    res.set(key, value);
                });
            }

            if (result.body) {
                const responseBody = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
                res.send(responseBody);
            } else {
                res.end();
            }
        } catch (error) {
            console.error('API Error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    };
}

// 本地模拟 Edge BFF 内联处理 qrcode-generate
let cachedQrCodeLib = null;
function getQrCodeLib() {
    if (!cachedQrCodeLib) {
        const qrcodeFile = path.join(__dirname, 'netlify/edge-functions/qrcode-lib.js');
        const content = fs.readFileSync(qrcodeFile, 'utf8');
        const code = content.replace(/export\s+default\s+qrcode;?/, '; globalThis.__qrcode = qrcode;');
        const ctx = { globalThis: {} };
        vm.runInNewContext(code, ctx);
        cachedQrCodeLib = ctx.globalThis.__qrcode;
    }
    return cachedQrCodeLib;
}

const QR_MIN_SIZE = 200;
const QR_MAX_SIZE = 600;
const QR_MAX_DATA_LENGTH = 2048;
const QR_MARGIN_MODULES = 8;

function handleQRCodeGenerate(req, res) {
    if (!checkBffOriginGate(req, res, 'qrcode-generate')) {
        return;
    }
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { data, size = 300 } = req.body || {};
    if (typeof data !== 'string' || data.length < 1 || data.length > QR_MAX_DATA_LENGTH) {
        return res.status(400).json({
            error: `data must be a string between 1 and ${QR_MAX_DATA_LENGTH} characters`
        });
    }

    const numSize = Number(size);
    if (!Number.isInteger(numSize) || numSize < QR_MIN_SIZE || numSize > QR_MAX_SIZE) {
        return res.status(400).json({
            error: `size must be an integer between ${QR_MIN_SIZE} and ${QR_MAX_SIZE}`
        });
    }

    try {
        const qrLib = getQrCodeLib();
        const qr = qrLib(0, 'M');
        qr.addData(data);
        qr.make();
        const moduleCount = qr.getModuleCount();
        const cellSize = Math.max(1, Math.floor(numSize / (moduleCount + QR_MARGIN_MODULES)));
        const qrcode = qr.createDataURL(cellSize, cellSize * 4);
        return res.status(200).json({ success: true, qrcode });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return res.status(500).json({ error: err.message });
    }
}

// API端点（同时挂 /.netlify/functions/* 与 /bff/*，本地模拟 Edge BFF 代理）
const functionRoutes = [
  ['giffgaff-mfa-challenge', giffgaffMfaChallenge],
  ['giffgaff-mfa-validation', giffgaffMfaValidation],
  ['giffgaff-graphql', giffgaffGraphql],
  ['giffgaff-token-exchange', giffgaffTokenExchange],
  ['verify-cookie', verifyCookie],
  ['giffgaff-sms-activate', giffgaffSmsActivate],
  ['auto-activate-esim', autoActivateEsim],
  ['public-config', publicConfig],
  ['health', health],
  ['notifications', notifications]
];

// 注册所有 Netlify Functions 路由
app.locals.functionRoutes = functionRoutes.map(([name]) => `/.netlify/functions/${name}`);
functionRoutes.forEach(([name, handler]) => {
  const wrapped = wrapNetlifyFunction(handler);
  app.use(`/.netlify/functions/${name}`, wrapped);
  app.use(`/bff/${name}`, wrapped);
});

// 注册本地 Edge 内联路由（qrcode-generate）
app.all('/bff/qrcode-generate', handleQRCodeGenerate);
app.all('/.netlify/functions/qrcode-generate', handleQRCodeGenerate);

// 注册完整的 BFF 路由列表供测试和端点清单检验
const bffTargetNames = [
  ...functionRoutes.map(([name]) => name),
  'qrcode-generate'
];
app.locals.bffRoutes = bffTargetNames.map(name => `/bff/${name}`);

// 校验与清洗代理子路径（防止路径遍历与 SSRF，符合 CodeQL js/request-forgery 规范）
const SIMYO_ALLOWED_HOST = 'appapi.simyo.nl';
const GIFFGAFF_ALLOWED_HOSTS = new Set([
    'api.giffgaff.com',
    'id.giffgaff.com',
    'publicapi.giffgaff.com'
]);

function sanitizeProxySubpath(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') return { normalizedPath: '/', queryString: '' };
    const [pathPart, queryPart] = rawPath.split('?');
    let decodedPath = pathPart;
    try {
        decodedPath = decodeURIComponent(pathPart);
    } catch {
        return null;
    }
    if (decodedPath.includes('..') || decodedPath.includes('\\')) {
        return null;
    }
    const normalized = path.posix.normalize('/' + decodedPath.replace(/^\/+/, ''));
    if (normalized.includes('..') || !/^\/[a-zA-Z0-9_\-./]*$/.test(normalized)) {
        return null;
    }
    return {
        normalizedPath: normalized,
        queryString: queryPart ? `?${queryPart}` : ''
    };
}

// Simyo API代理路由（支持 /api/simyo/v2/* → webapi/api/v2，其余 → webapi/api/v1）
// 注：Express 5 的 path-to-regexp v8 不再支持裸 `*` 通配符，改用命名通配符 *splat
app.use('/api/simyo/*splat', (req, res) => {
    const rawSubpath = req.originalUrl.replace(/^\/api\/simyo/, '');
    const subpathInfo = sanitizeProxySubpath(rawSubpath);
    if (!subpathInfo) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid API path' });
    }
    const { normalizedPath, queryString } = subpathInfo;
    const isV2 = normalizedPath === '/v2' || normalizedPath.startsWith('/v2/');
    const apiVersionPath = isV2 ? normalizedPath.replace(/^\/v2/, '') || '/' : normalizedPath;
    const basePrefix = isV2 ? '/webapi/api/v2' : '/webapi/api/v1';

    const targetUrlObj = new URL(`https://${SIMYO_ALLOWED_HOST}`);
    targetUrlObj.pathname = path.posix.join(basePrefix, apiVersionPath);
    if (queryString) {
        targetUrlObj.search = queryString.replace(/^\?/, '');
    }

    if (targetUrlObj.hostname !== SIMYO_ALLOWED_HOST || targetUrlObj.protocol !== 'https:' || !targetUrlObj.pathname.startsWith(basePrefix)) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid target destination' });
    }

    const targetUrl = targetUrlObj.toString();

    const headers = {
        'User-Agent': req.headers['user-agent'] || DEFAULT_SIMYO_USER_AGENT,
        'Accept': req.headers['accept'] || 'application/json',
        'X-Simyo-Platform': req.headers['x-simyo-platform'] || DEFAULT_SIMYO_CLIENT_PLATFORM,
        'X-Simyo-Client-Version': req.headers['x-simyo-client-version'] || DEFAULT_SIMYO_CLIENT_VERSION,
        'X-Simyo-Device-Id': req.headers['x-simyo-device-id'] || getDefaultSimyoDeviceId()
    };

    const simyoToken = process.env.SIMYO_CLIENT_TOKEN || 'e77b7e2f43db41bb95b17a2a11581a38';
    headers['X-Client-Token'] = simyoToken;
    if (process.env.SIMYO_CLIENT_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.SIMYO_CLIENT_TOKEN}`;
    }

    // 复制特定请求头
    ['content-type', 'authorization'].forEach(header => {
        if (req.headers[header]) {
            headers[header] = req.headers[header];
        }
    });

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const protocol = isSecure ? 'https' : 'http';
    const host = req.headers.host || `localhost:${PORT}`;
    const clientOrigin = `${protocol}://${host}`;
    headers['X-Forwarded-Host'] = SIMYO_ALLOWED_HOST;
    headers['Origin'] = clientOrigin;
    headers['Referer'] = `${clientOrigin}/`;

    const fetchOptions = {
        method: req.method,
        headers: headers
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
    }

    fetch(targetUrl, fetchOptions)
        .then(response => {
            res.status(response.status);

            // 转发响应头
            response.headers.forEach((value, key) => {
                if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
                    res.set(key, value);
                }
            });

            // 允许跨域
            const origin = req.headers.origin;
            const allowedOrigin = getCorsOrigin(origin);
            if (allowedOrigin) {
                res.set('Access-Control-Allow-Origin', allowedOrigin);
                res.set('Vary', 'Origin');
            }

            return response.text();
        })
        .then(data => {
            res.send(data);
        })
        .catch(error => {
            console.error('Simyo Proxy Error:', error);
            res.status(500).json({
                error: 'Proxy Error',
                message: error.message
            });
        });
});

// Giffgaff API代理路由
function handleGiffgaffProxy(req, res, routePrefix, targetHost) {
    if (!GIFFGAFF_ALLOWED_HOSTS.has(targetHost)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Target host not allowed' });
    }

    const rawSubpath = req.originalUrl.slice(routePrefix.length);
    const subpathInfo = sanitizeProxySubpath(rawSubpath);
    if (!subpathInfo) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid proxy path' });
    }

    const targetUrlObj = new URL(`https://${targetHost}`);
    targetUrlObj.pathname = subpathInfo.normalizedPath;
    if (subpathInfo.queryString) {
        targetUrlObj.search = subpathInfo.queryString.replace(/^\?/, '');
    }

    if (!GIFFGAFF_ALLOWED_HOSTS.has(targetUrlObj.hostname) || targetUrlObj.protocol !== 'https:') {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid target destination' });
    }

    forwardRequest(req, res, targetUrlObj.toString(), targetHost);
}

app.use('/api/giffgaff/*splat', (req, res) => {
    handleGiffgaffProxy(req, res, '/api/giffgaff', 'api.giffgaff.com');
});

app.use('/api/giffgaff-id/*splat', (req, res) => {
    handleGiffgaffProxy(req, res, '/api/giffgaff-id', 'id.giffgaff.com');
});

app.use('/api/giffgaff-public/*splat', (req, res) => {
    handleGiffgaffProxy(req, res, '/api/giffgaff-public', 'publicapi.giffgaff.com');
});

// 通用请求转发函数（严格限制目标主机与协议）
function forwardRequest(req, res, targetUrl, forwardHost) {
    if (!GIFFGAFF_ALLOWED_HOSTS.has(forwardHost)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Forward host not allowed' });
    }

    const parsedTarget = new URL(targetUrl);
    if (parsedTarget.hostname !== forwardHost || parsedTarget.protocol !== 'https:') {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid forward target' });
    }

    const headers = Object.assign({}, req.headers);
    delete headers.host;
    delete headers['content-length'];
    delete headers['content-encoding'];
    delete headers['transfer-encoding'];
    headers['X-Forwarded-Host'] = forwardHost;

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const protocol = isSecure ? 'https' : 'http';
    const host = req.headers.host || `localhost:${PORT}`;
    const clientOrigin = `${protocol}://${host}`;
    headers['Origin'] = clientOrigin;
    headers['Referer'] = `${clientOrigin}/`;

    const fetchOptions = {
        method: req.method,
        headers: headers
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
    }

    fetch(parsedTarget.toString(), fetchOptions)
        .then(response => {
            res.status(response.status);

            response.headers.forEach((value, key) => {
                if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
                    res.set(key, value);
                }
            });

            // 允许跨域
            const origin = req.headers.origin;
            const allowedOrigin = getCorsOrigin(origin);
            if (allowedOrigin) {
                res.set('Access-Control-Allow-Origin', allowedOrigin);
                res.set('Vary', 'Origin');
            }

            return response.text();
        })
        .then(data => {
            res.send(data);
        })
        .catch(error => {
            console.error('Proxy Error:', error);
            res.status(500).json({
                error: 'Proxy Error',
                message: error.message
            });
        });
}

// 兜底静态页面路由（应用静态限流保护，避免未受限文件系统读取与 DoS）
app.get('/giffgaff', staticPageLimiter, (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'src/giffgaff/giffgaff_modular.html'));
});

app.get('/simyo', staticPageLimiter, (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'src/simyo/simyo_modular.html'));
});

app.get('/', staticPageLimiter, (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'index.html'));
});

// 404 处理
app.use(staticPageLimiter, (req, res) => {
    res.status(404).sendFile(path.join(STATIC_ROOT, 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large' || err.status === 413) {
        return res.status(413).json({
            error: 'Payload Too Large',
            message: 'Request entity too large'
        });
    }
    if (err.type === 'entity.parse.failed' || err.status === 400 || (err instanceof SyntaxError && err.status === 400)) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid JSON payload format'
        });
    }
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 仅在直接运行时启动服务器，被测试引用时导出 app
if (require.main === module) {
    app.listen(PORT, () => {
        Logger.log(`🚀 本地开发服务器运行在 http://localhost:${PORT}`);
        Logger.log(`📁 静态文件根目录: ${STATIC_ROOT}`);
        Logger.log(`🔑 ACCESS_KEY: ${INTERNAL_FUNCTION_KEY ? '已配置' : '未配置'}`);
        Logger.log(`📱 Simyo Client Token: ${process.env.SIMYO_CLIENT_TOKEN ? '已配置' : '未配置'}`);
    });
}

module.exports = app;
