// Simyo API 配置（与 client-identity.js 同步）
const crypto = require('crypto');
const SIMYO_CLIENT_VERSION = process.env.SIMYO_CLIENT_VERSION || '4.28.0';
const SIMYO_IOS_VERSION = process.env.SIMYO_IOS_VERSION || '18.2';
const SIMYO_DEVICE_MODEL = process.env.SIMYO_DEVICE_MODEL || 'iPhone12,8';
const SIMYO_USER_AGENT =
  process.env.SIMYO_USER_AGENT ||
  `MijnSimyoFT/${SIMYO_CLIENT_VERSION}  (iOS ${SIMYO_IOS_VERSION}; ${SIMYO_DEVICE_MODEL})`;
const SIMYO_DEVICE_ID = process.env.SIMYO_DEVICE_ID || crypto.randomUUID().toUpperCase();
const SIMYO_CONFIG = {
    baseUrl: 'https://appapi.simyo.nl/webapi/api/v1',
    headers: {
        'X-Client-Token': process.env.SIMYO_CLIENT_TOKEN || '',
        'X-Client-Platform': process.env.SIMYO_CLIENT_PLATFORM || 'ios',
        'X-Client-Version': SIMYO_CLIENT_VERSION,
        'X-Device-ID': SIMYO_DEVICE_ID,
        'User-Agent': SIMYO_USER_AGENT,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Connection: 'keep-alive',
        'Accept-Encoding': 'gzip'
    }
};
