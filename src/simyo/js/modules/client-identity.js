/**
 * Simyo 官方 App 客户端身份（单一事实来源）
 *
 * 对齐 Mijn Simyo iOS 抓包（2026-07-22 eSIM 更换 HAR）：
 * - App 版本: 4.28.0
 * - API User-Agent: MijnSimyoFT/4.28.0  (iOS 18.2; iPhone12,8)
 *   （版本号与括号之间为两个空格）
 * - 平台: ios
 * - 设备型号: iPhone12,8
 * - 系统版本: 18.2
 *
 * 修改此处后请同步：
 * - server.js 中的 DEFAULT_SIMYO_* 常量
 * - src/simyo/simyo_proxy_server.js 中的 SIMYO_CONFIG.headers
 * - netlify.toml 中 /api/simyo 代理的 User-Agent 覆盖
 * - env.example 注释示例
 */

/** 官方 App 版本号（X-Client-Version） */
export const SIMYO_CLIENT_VERSION = '4.28.0';

/** 官方平台（X-Client-Platform） */
export const SIMYO_CLIENT_PLATFORM = 'ios';

/** 官方客户端 Token（X-Client-Token） */
export const SIMYO_CLIENT_TOKEN = 'e77b7e2f43db41bb95b17a2a11581a38';

/** 抓包中的 iOS 系统版本 */
export const SIMYO_IOS_VERSION = '18.2';

/** 抓包中的设备型号（identifier） */
export const SIMYO_DEVICE_MODEL = 'iPhone12,8';

/**
 * appapi 请求使用的 User-Agent
 * 注意：版本号后必须保留两个空格，与官方 Flutter 客户端一致
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
