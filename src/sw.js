// Service Worker for eSIM Tools
const CACHE_NAME = 'eSIM-Tools-v2.1.0';
const STATIC_CACHE = 'static-v2.1.0';
const DYNAMIC_CACHE = 'dynamic-v2.1.0';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/giffgaff/giffgaff_complete_esim.html',
  '/src/simyo/simyo_complete_esim.html',
  '/src/styles/design-system.css',
  '/netlify/functions/auto-activate-esim.js',
  '/netlify/functions/giffgaff-graphql.js',
  '/netlify/functions/giffgaff-mfa-challenge.js',
  '/netlify/functions/giffgaff-mfa-validation.js',
  '/netlify/functions/verify-cookie.js'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        // 缓存静态资源
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('Failed to cache static assets:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            return caches.delete(cacheName);
          }
        })
      ))
      .then(() => self.clients.claim())
  );
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 处理API请求
  if (url.pathname.startsWith('/netlify/functions/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // 处理静态资源
  if (request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
    return;
  }
});

// 处理API请求 - 网络优先策略
async function handleApiRequest(request) {
  try {
    // 尝试网络请求
    const networkResponse = await fetch(request);

    // 如果成功，缓存响应
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // 网络失败，尝试从缓存获取
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // 返回离线页面
    return caches.match('/index.html');
  }
}

// 处理静态资源 - 缓存优先策略
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // 在后台更新缓存
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(request, response);
        });
      }
    }).catch(() => {
      // 忽略更新失败
    });

    return cachedResponse;
  }

  // 缓存中没有，尝试网络请求
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // 返回离线页面
    return caches.match('/index.html');
  }
}

// 消息处理 - 用于与主线程通信
self.addEventListener('message', event => {
  // 验证消息来源，防止跨域 postMessage 攻击
  if (event.origin && event.origin !== self.location.origin) {
    return;
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
