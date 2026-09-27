/**
 * Request validation middleware
 */

/**
 * Validate request body size
 */
function validateBodySize(maxSize = 1024 * 1024) { // 1MB default
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];

    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request body exceeds ${maxSize} bytes`
      });
    }

    next();
  };
}

/**
 * Validate required headers
 */
function validateHeaders(requiredHeaders = []) {
  return (req, res, next) => {
    const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: 'Missing Required Headers',
        missing: missingHeaders
      });
    }

    next();
  };
}

/**
 * Sanitize request parameters
 */
function sanitizeParams(req, res, next) {
  // Remove potential XSS from query params
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key]
          .replace(/<\s*\/?\s*(?:script|iframe|object|embed|form|input|textarea|button|link|meta|base)[^>]*>/gi, '')
          .replace(/javascript\s*:/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
          .trim();
      }
    });
  }

  next();
}

/**
 * Simple in-memory rate limiter
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000, // 1 minute
    maxRequests = 100,
    message = 'Too many requests, please try again later.'
  } = options;

  const clients = new Map();

  // Clean up old entries periodically
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of clients.entries()) {
      if (now - value.resetTime > windowMs) {
        clients.delete(key);
      }
    }
  }, windowMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  const limiterMiddleware = (req, res, next) => {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    if (!clients.has(key)) {
      clients.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    const client = clients.get(key);

    if (now > client.resetTime) {
      client.count = 1;
      client.resetTime = now + windowMs;
      return next();
    }

    if (client.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil((client.resetTime - now) / 1000)
      });
    }

    client.count++;
    next();
  };

  limiterMiddleware.dispose = () => {
    clearInterval(timer);
    clients.clear();
  };

  return limiterMiddleware;
}

/**
 * Error boundary wrapper for async route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  validateBodySize,
  validateHeaders,
  sanitizeParams,
  createRateLimiter,
  asyncHandler
};
