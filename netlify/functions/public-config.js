const DEFAULT_PROVIDER = 'off';

const handler = async () => {
  const providerEnv = (process.env.CAPTCHA_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  const provider = ['recaptcha', 'off'].includes(providerEnv) ? providerEnv : DEFAULT_PROVIDER;

  const payload = {
    provider,
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
  };

  // 如果未提供 site key，则降级为 off
  if (payload.provider === 'recaptcha' && !payload.recaptchaSiteKey) {
    payload.provider = 'off';
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
