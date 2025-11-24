const DEFAULT_PROVIDER = 'turnstile';

const handler = async () => {
  const providerEnv = (process.env.CAPTCHA_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  const provider = ['turnstile', 'recaptcha', 'off'].includes(providerEnv) ? providerEnv : DEFAULT_PROVIDER;

  const payload = {
    provider,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
    turnstileEnforce: (process.env.TURNSTILE_ENFORCE || 'true').toLowerCase() !== 'false',
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
  };

  // 如果未提供 site key，则自动降级为 off
  if (payload.provider === 'turnstile' && !payload.turnstileSiteKey) {
    payload.provider = 'off';
  }
  if (payload.provider === 'recaptcha' && !payload.recaptchaSiteKey) {
    payload.provider = payload.turnstileSiteKey ? 'turnstile' : 'off';
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300'
    },
    body: JSON.stringify(payload)
  };
};

module.exports = { handler };
