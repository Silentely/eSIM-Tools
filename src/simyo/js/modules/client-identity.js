/**
 * Simyo 客户端身份配置（单一事实来源）
 *
 * 字段说明：
 * - clientVersion: X-Client-Version
 * - userAgent: MijnSimyoFT/{version}  (iOS {ios}; {model})
 *   （版本号与括号之间为两个空格）
 * - platform: X-Client-Platform（ios）
 *
 * 修改此处后请同步：
 * - server.js 中的 DEFAULT_SIMYO_* 常量
 * - src/simyo/simyo_proxy_server.js 中的 SIMYO_CONFIG.headers
 * - netlify.toml 中 /api/simyo 代理的 User-Agent 覆盖
 * - env.example 注释示例
 */

/** X-Client-Version */
export const SIMYO_CLIENT_VERSION = '4.28.0';

/** X-Client-Platform */
export const SIMYO_CLIENT_PLATFORM = 'ios';

/** X-Client-Token */
export const SIMYO_CLIENT_TOKEN = 'e77b7e2f43db41bb95b17a2a11581a38';

/** User-Agent 中的 iOS 系统版本 */
export const SIMYO_IOS_VERSION = '18.2';

/** User-Agent 中的设备型号 */
export const SIMYO_DEVICE_MODEL = 'iPhone12,8';

/**
 * 发往 appapi 的 User-Agent
 * 版本号后必须保留两个空格
 */
export const SIMYO_USER_AGENT =
  `MijnSimyoFT/${SIMYO_CLIENT_VERSION}  (iOS ${SIMYO_IOS_VERSION}; ${SIMYO_DEVICE_MODEL})`;

/**
 * 聚合配置，便于 createHeaders / 测试一次性读取
 */
export const simyoClientIdentity = Object.freeze({
  clientToken: SIMYO_CLIENT_TOKEN,
  clientPlatform: SIMYO_CLIENT_PLATFORM,
  clientVersion: SIMYO_CLIENT_VERSION,
  iosVersion: SIMYO_IOS_VERSION,
  deviceModel: SIMYO_DEVICE_MODEL,
  userAgent: SIMYO_USER_AGENT
});
