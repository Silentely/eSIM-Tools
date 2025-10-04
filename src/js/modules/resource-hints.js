/**
 * Resource Hints Configuration
 * Manages preload, prefetch, preconnect for optimal resource loading
 */

class ResourceHintsManager {
  constructor() {
    this.hints = {
      preconnect: [
        'https://api.giffgaff.com',
        'https://id.giffgaff.com',
        'https://publicapi.giffgaff.com',
        'https://appapi.simyo.nl',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com'
      ],
      dnsPrefetch: [
        'https://api.qrserver.com',
        'https://qrcode.show'
      ],
      preload: {
        fonts: [],
        scripts: [
          { href: '/dist/js/main.js', as: 'script' },
          { href: '/dist/js/vendors.js', as: 'script' }
        ],
        styles: [
          { href: '/dist/css/design-system.css', as: 'style' }
        ],
        images: []
      },
      prefetch: {
        routes: [
          '/giffgaff',
          '/simyo'
        ],
        data: []
      }
    };
  }

  /**
   * Initialize all resource hints
   */
  init() {
    this.addPreconnectHints();
    this.addDNSPrefetchHints();
    this.addPreloadHints();
    this.setupIntersectionPrefetch();
    this.setupIdlePrefetch();
  }

  /**
   * Add preconnect hints for critical origins
   */
  addPreconnectHints() {
    this.hints.preconnect.forEach(origin => {
      this.createLink({
        rel: 'preconnect',
        href: origin,
        crossOrigin: 'anonymous'
      });
    });
  }

  /**
   * Add DNS prefetch hints for non-critical origins
   */
  addDNSPrefetchHints() {
    this.hints.dnsPrefetch.forEach(origin => {
      this.createLink({
        rel: 'dns-prefetch',
        href: origin
      });
    });
  }

  /**
   * Add preload hints for critical resources
   */
  addPreloadHints() {
    // Preload fonts
    this.hints.preload.fonts.forEach(font => {
      this.createLink({
        rel: 'preload',
        href: font.href,
        as: 'font',
        type: font.type || 'font/woff2',
        crossOrigin: 'anonymous'
      });
    });

    // Preload scripts
    this.hints.preload.scripts.forEach(script => {
      this.createLink({
        rel: 'preload',
        href: script.href,
        as: 'script'
      });
    });

    // Preload styles
    this.hints.preload.styles.forEach(style => {
      this.createLink({
        rel: 'preload',
        href: style.href,
        as: 'style'
      });
    });

    // Preload critical images
    this.hints.preload.images.forEach(image => {
      this.createLink({
        rel: 'preload',
        href: image.href,
        as: 'image',
        type: image.type || 'image/webp'
      });
    });
  }

  /**
   * Setup intersection observer-based prefetching
   * Prefetch resources when links become visible
   */
  setupIntersectionPrefetch() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const link = entry.target;
          const href = link.getAttribute('href');
          
          if (href && !link.dataset.prefetched) {
            this.prefetchRoute(href);
            link.dataset.prefetched = 'true';
            observer.unobserve(link);
          }
        }
      });
    }, {
      rootMargin: '100px' // Start prefetching 100px before link is visible
    });

    // Observe all internal links
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      observer.observe(link);
    });
  }

  /**
   * Setup idle-time prefetching
   * Prefetch routes during browser idle time
   */
  setupIdlePrefetch() {
    if (!('requestIdleCallback' in window)) {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => this.prefetchIdleResources(), 3000);
      return;
    }

    requestIdleCallback(() => {
      this.prefetchIdleResources();
    }, { timeout: 5000 });
  }

  /**
   * Prefetch resources during idle time
   */
  prefetchIdleResources() {
    // Prefetch alternate routes
    this.hints.prefetch.routes.forEach(route => {
      this.prefetchRoute(route);
    });

    // Prefetch data endpoints
    this.hints.prefetch.data.forEach(endpoint => {
      this.prefetchData(endpoint);
    });
  }

  /**
   * Prefetch a route
   */
  prefetchRoute(href) {
    this.createLink({
      rel: 'prefetch',
      href,
      as: 'document'
    });
  }

  /**
   * Prefetch data endpoint
   */
  prefetchData(url) {
    // Use fetch with low priority if supported
    if ('fetch' in window) {
      fetch(url, {
        priority: 'low',
        credentials: 'same-origin'
      }).catch(() => {
        // Ignore prefetch errors
      });
    }
  }

  /**
   * Create and append link element to head
   */
  createLink(attributes) {
    const link = document.createElement('link');
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (value) {
        if (key === 'crossOrigin') {
          link.crossOrigin = value;
        } else {
          link.setAttribute(key, value);
        }
      }
    });

    // Check if link already exists
    const existing = document.head.querySelector(
      `link[rel="${attributes.rel}"][href="${attributes.href}"]`
    );

    if (!existing) {
      document.head.appendChild(link);
    }

    return link;
  }

  /**
   * Dynamically add preconnect hint
   */
  addPreconnect(origin) {
    if (!this.hints.preconnect.includes(origin)) {
      this.hints.preconnect.push(origin);
      this.createLink({
        rel: 'preconnect',
        href: origin,
        crossOrigin: 'anonymous'
      });
    }
  }

  /**
   * Dynamically add preload hint
   */
  addPreload(href, as, type = null) {
    const options = { rel: 'preload', href, as };
    if (type) options.type = type;
    if (as === 'font') options.crossOrigin = 'anonymous';
    
    this.createLink(options);
  }

  /**
   * Dynamically add prefetch hint
   */
  addPrefetch(href, as = 'document') {
    this.createLink({
      rel: 'prefetch',
      href,
      as
    });
  }

  /**
   * Preload critical CSS
   */
  preloadCSS(href) {
    const link = this.createLink({
      rel: 'preload',
      href,
      as: 'style',
      onload: "this.onload=null;this.rel='stylesheet'"
    });

    // Fallback for browsers that don't support preload
    setTimeout(() => {
      if (link.rel !== 'stylesheet') {
        link.rel = 'stylesheet';
      }
    }, 100);
  }

  /**
   * Get all active resource hints
   */
  getActiveHints() {
    const links = document.head.querySelectorAll('link[rel="preconnect"], link[rel="prefetch"], link[rel="preload"], link[rel="dns-prefetch"]');
    return Array.from(links).map(link => ({
      rel: link.rel,
      href: link.href,
      as: link.as
    }));
  }
}

// Export singleton instance
const resourceHints = new ResourceHintsManager();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => resourceHints.init());
} else {
  resourceHints.init();
}

export default resourceHints;
export { ResourceHintsManager };
