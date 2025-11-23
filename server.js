/**
 * 本地开发服务器
 * 提供静态文件服务和API代理功能
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, process.env.STATIC_ROOT || 'dist');
const INTERNAL_FUNCTION_KEY = process.env.ACCESS_KEY || process.env.ESIM_ACCESS_KEY || '';

// 启动时环境检查
if (!INTERNAL_FUNCTION_KEY) {
    console.error('❌ ACCESS_KEY 或 ESIM_ACCESS_KEY 未配置');
    console.error('💡 请在 .env 文件或环境变量中设置 ACCESS_KEY');
    console.error('⚠️  Netlify Functions 将无法正常工作，请修复后重启');
}

if (!fs.existsSync(STATIC_ROOT)) {
    console.warn(`⚠️  静态目录 ${STATIC_ROOT} 不存在，请先运行 npm run build`);
    console.warn('💡 运行: npm run build');
}

// 中间件配置
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "https://qrcode.show", "https://api.qrserver.com", "https://appapi.simyo.nl", "https://api.giffgaff.com", "https://id.giffgaff.com", "https://publicapi.giffgaff.com"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"]
        }
    }
}));

// 仅允许特定来源访问本地API（前端文件本地打开时可能 Origin 为 undefined）
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://esim.cosr.eu.org';
app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true); // 非浏览器/本地文件放行
        if (origin === ALLOWED_ORIGIN) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: false
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const staticMiddleware = express.static(STATIC_ROOT, { fallthrough: true, index: false });
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

// 包装Netlify Functions为Express路由
function wrapNetlifyFunction(handler) {
    return async (req, res) => {
        try {
            const headers = Object.assign({}, req.headers);
            // 仅在客户端未提供密钥时注入内部密钥（避免覆盖）
            if (INTERNAL_FUNCTION_KEY && !headers['x-esim-key'] && !headers['x-app-key']) {
                headers['x-esim-key'] = INTERNAL_FUNCTION_KEY;
            }
            const event = {
                httpMethod: req.method,
                headers,
                body: JSON.stringify(req.body),
                queryStringParameters: req.query
            };

            const context = {};
            const result = await handler.handler(event, context);

            res.status(result.statusCode);
            
            if (result.headers) {
                Object.entries(result.headers).forEach(([key, value]) => {
                    res.set(key, value);
                });
            }

            if (result.body) {
                const body = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
                res.send(body);
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

// API端点
app.use('/.netlify/functions/giffgaff-mfa-challenge', wrapNetlifyFunction(giffgaffMfaChallenge));
app.use('/.netlify/functions/giffgaff-mfa-validation', wrapNetlifyFunction(giffgaffMfaValidation));
app.use('/.netlify/functions/giffgaff-graphql', wrapNetlifyFunction(giffgaffGraphql));
app.use('/.netlify/functions/giffgaff-token-exchange', wrapNetlifyFunction(giffgaffTokenExchange));
app.use('/.netlify/functions/verify-cookie', wrapNetlifyFunction(verifyCookie));
app.use('/.netlify/functions/giffgaff-sms-activate', wrapNetlifyFunction(giffgaffSmsActivate));

// Simyo API代理路由
app.use('/api/simyo/*', (req, res) => {
    const targetUrl = `https://appapi.simyo.nl/simyoapi/api/v1${req.path.replace('/api/simyo', '')}`;
    console.log(`[Simyo Proxy] ${req.method} ${req.path} -> ${targetUrl}`);
    
    // 设置CORS头（仅允许指定域）
    res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Token, X-Client-Platform, X-Client-Version');
    res.header('Vary', 'Origin');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // 代理请求
    const axios = require('axios');
    const config = {
        method: req.method.toLowerCase(),
        url: targetUrl,
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': req.headers['user-agent'] || 'MijnSimyo/4.8.0 (iPhone; iOS 17.5.1; Scale/3.00)',
            'X-Client-Token': req.headers['x-client-token'] || 'e77b7e2f43db41bb95b17a2a11581a38',
            'X-Client-Platform': req.headers['x-client-platform'] || 'ios',
            'X-Client-Version': req.headers['x-client-version'] || '4.8.0'
        },
        timeout: 30000
    };
    
    if (req.body && Object.keys(req.body).length > 0) {
        config.data = req.body;
    }
    
    axios(config)
        .then(response => {
            res.status(response.status).json(response.data);
        })
        .catch(error => {
            console.error('[Simyo Proxy Error]:', error.message);
            const status = error.response?.status || 500;
            const data = error.response?.data || { error: 'Proxy Error', message: error.message };
            res.status(status).json(data);
        });
});

// 路由配置
const htmlRoutes = [
    { url: '/giffgaff', file: 'src/giffgaff/giffgaff_modular.html' },
    { url: '/giffgaff-legacy', file: 'src/giffgaff/giffgaff_complete_esim.html' },
    { url: '/simyo', file: 'src/simyo/simyo_modular.html' },
    { url: '/simyo-legacy', file: 'src/simyo/simyo_complete_esim.html' },
    { url: '/simyo-static', file: 'src/simyo/simyo_static.html' },
    // 兼容静态路径访问（与 Netlify 重写保持一致）
    { url: '/src/giffgaff/giffgaff_modular.html', file: 'src/giffgaff/giffgaff_modular.html' },
    { url: '/src/giffgaff/giffgaff_complete_esim.html', file: 'src/giffgaff/giffgaff_complete_esim.html' },
    { url: '/src/simyo/simyo_modular.html', file: 'src/simyo/simyo_modular.html' },
    { url: '/src/simyo/simyo_complete_esim.html', file: 'src/simyo/simyo_complete_esim.html' },
    { url: '/src/simyo/simyo_static.html', file: 'src/simyo/simyo_static.html' },
    { url: '/', file: 'index.html' }
];

htmlRoutes.forEach(({ url, file }) => {
    app.get(url, (req, res) => {
        res.sendFile(path.join(STATIC_ROOT, file));
    });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
    });
});

// 404处理
app.use((req, res) => {
    // 优先返回 HTML 404 页面（如果存在）
    const html404Path = path.join(STATIC_ROOT, '404.html');
    if (fs.existsSync(html404Path) && req.accepts('html')) {
        return res.status(404).sendFile(html404Path);
    }

    // API 请求或无 404 页面时返回 JSON
    res.status(404).json({
        error: 'Not Found',
        message: '请求的资源不存在'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 eSIM工具服务器已启动`);
    console.log(`📍 本地地址: http://localhost:${PORT}`);
    console.log(`🔧 Giffgaff工具: http://localhost:${PORT}/giffgaff`);
    console.log(`📱 Simyo工具: http://localhost:${PORT}/simyo`);
    console.log(`🌐 环境: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
