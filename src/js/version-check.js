/**
 * Detect a newer deployed build and offer a safe page refresh.
 *
 * This runs without a Service Worker. The version endpoint is requested with
 * cache disabled so a browser cannot keep an old entry point indefinitely.
 */

const VERSION_ENDPOINT = '/version.json';
const NOTICE_ID = 'esim-tools-update-notice';

export function getCurrentBuildVersion(documentRef = document) {
  return documentRef
    .querySelector('meta[name="build-rev"]')
    ?.getAttribute('content')
    ?.trim() || '';
}

function getLocale(documentRef) {
  return documentRef.documentElement?.getAttribute('lang')?.toLowerCase().startsWith('zh')
    ? 'zh'
    : 'en';
}

function showUpdateNotice(documentRef, windowRef) {
  if (documentRef.getElementById(NOTICE_ID)) return;

  const isZh = getLocale(documentRef) === 'zh';
  const notice = documentRef.createElement('div');
  notice.id = NOTICE_ID;
  notice.setAttribute('role', 'alertdialog');
  notice.setAttribute('aria-live', 'polite');
  notice.style.cssText = [
    'position:fixed',
    'left:16px',
    'right:16px',
    'bottom:16px',
    'z-index:10000',
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:12px',
    'padding:14px 16px',
    'border:1px solid #f59e0b',
    'border-radius:12px',
    'background:#fffbeb',
    'box-shadow:0 8px 24px rgba(0,0,0,.18)',
    'color:#78350f',
    'font:600 14px/1.4 system-ui,sans-serif'
  ].join(';');

  const message = documentRef.createElement('span');
  message.textContent = isZh
    ? '网站已更新，请刷新页面以使用最新版本。'
    : 'A new version is available. Refresh to continue.';

  const refreshButton = documentRef.createElement('button');
  refreshButton.type = 'button';
  refreshButton.textContent = isZh ? '立即刷新' : 'Refresh now';
  refreshButton.style.cssText = [
    'flex:none',
    'border:0',
    'border-radius:8px',
    'padding:8px 12px',
    'background:#d97706',
    'color:#fff',
    'cursor:pointer',
    'font:inherit'
  ].join(';');
  refreshButton.addEventListener('click', () => windowRef.location.reload());

  notice.append(message, refreshButton);
  (documentRef.body || documentRef.documentElement).appendChild(notice);
}

export async function checkForUpdates({
  documentRef = document,
  windowRef = window,
  fetchImpl = windowRef.fetch.bind(windowRef)
} = {}) {
  const currentVersion = getCurrentBuildVersion(documentRef);
  if (!currentVersion || typeof fetchImpl !== 'function') return false;

  try {
    const response = await fetchImpl(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) return false;

    const payload = await response.json();
    if (payload?.version && payload.version !== currentVersion) {
      showUpdateNotice(documentRef, windowRef);
      return true;
    }
  } catch (_) {
    // Version checks are advisory and must never block the application.
  }

  return false;
}

if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  checkForUpdates();
}
