/* PWA install prompt handler */
(function () {
  let deferredInstallEvent = null;

  function createInstallUI() {
    if (document.getElementById('pwa-install-prompt')) return null;

    const container = document.createElement('div');
    container.id = 'pwa-install-prompt';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-live', 'polite');
    container.style.position = 'fixed';
    container.style.right = '20px';
    container.style.bottom = '20px';
    container.style.zIndex = '10000';
    container.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
    container.style.color = '#fff';
    container.style.padding = '12px 14px';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 8px 24px rgba(0,0,0,.18)';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '10px';

    const text = document.createElement('span');
    text.textContent = '安装 eSIM 工具为应用';
    text.style.fontWeight = '600';

    const installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.textContent = '安装';
    installBtn.style.background = '#10b981';
    installBtn.style.color = '#fff';
    installBtn.style.border = 'none';
    installBtn.style.padding = '8px 12px';
    installBtn.style.borderRadius = '999px';
    installBtn.style.cursor = 'pointer';
    installBtn.style.fontWeight = '700';

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.textContent = '稍后';
    dismissBtn.style.background = 'transparent';
    dismissBtn.style.color = '#fff';
    dismissBtn.style.border = '1px solid rgba(255,255,255,.5)';
    dismissBtn.style.padding = '8px 12px';
    dismissBtn.style.borderRadius = '999px';
    dismissBtn.style.cursor = 'pointer';

    installBtn.addEventListener('click', async () => {
      if (!deferredInstallEvent) return;
      try {
        deferredInstallEvent.prompt();
        const { outcome } = await deferredInstallEvent.userChoice;
        if (outcome === 'accepted') hide();
        deferredInstallEvent = null;
      } catch (_) {
        // ignore
      }
    });

    function hide() {
      container.remove();
      try { localStorage.setItem('pwa_install_dismissed', '1'); } catch (_) {}
    }

    dismissBtn.addEventListener('click', hide);

    container.appendChild(text);
    container.appendChild(installBtn);
    container.appendChild(dismissBtn);
    document.body.appendChild(container);
    return container;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    // Respect user dismissal for this session
    try {
      if (localStorage.getItem('pwa_install_dismissed') === '1') return;
    } catch (_) {}

    e.preventDefault();
    deferredInstallEvent = e;
    // show minimal UI
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createInstallUI, { once: true });
    } else {
      createInstallUI();
    }
  });

  window.addEventListener('appinstalled', () => {
    const promptEl = document.getElementById('pwa-install-prompt');
    if (promptEl) promptEl.remove();
    try { localStorage.removeItem('pwa_install_dismissed'); } catch (_) {}
  });
})();


