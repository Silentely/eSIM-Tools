/**
 * WebMCP 支持
 * 通过 navigator.modelContext.provideContext() 向 AI Agent 暴露站点工具
 * 文档: https://webmachinelearning.github.io/webmcp/
 */

(function initWebMCP() {
  // 检查 WebMCP API 是否可用
  if (!navigator.modelContext || typeof navigator.modelContext.provideContext !== 'function') {
    return;
  }

  const SITE_URL = 'https://esim.cosr.eu.org';

  // 定义暴露给 AI Agent 的工具
  const tools = [
    {
      name: 'giffgaff-esim-manage',
      description: '管理 Giffgaff eSIM：OAuth 认证、MFA 验证、eSIM 激活和 QR 码生成',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['auth', 'activate', 'get-qr'],
            description: '要执行的操作：auth=开始认证, activate=激活 eSIM, get-qr=获取 QR 码'
          }
        },
        required: ['action']
      },
      async execute(input) {
        switch (input.action) {
          case 'auth':
            window.location.href = `${SITE_URL}/giffgaff`;
            return { status: 'redirecting', message: '正在跳转到 Giffgaff 认证页面' };
          case 'activate':
            window.location.href = `${SITE_URL}/giffgaff`;
            return { status: 'redirecting', message: '正在跳转到 Giffgaff eSIM 激活页面' };
          case 'get-qr':
            window.location.href = `${SITE_URL}/giffgaff`;
            return { status: 'redirecting', message: '正在跳转到 QR 码生成页面' };
          default:
            return { status: 'error', message: '未知操作' };
        }
      }
    },
    {
      name: 'simyo-esim-manage',
      description: '管理 Simyo eSIM：登录验证、设备更换、eSIM 激活和 QR 码生成',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['auth', 'swap-device', 'activate', 'get-qr'],
            description: '要执行的操作：auth=开始登录, swap-device=更换设备, activate=激活 eSIM, get-qr=获取 QR 码'
          }
        },
        required: ['action']
      },
      async execute(input) {
        switch (input.action) {
          case 'auth':
          case 'swap-device':
          case 'activate':
          case 'get-qr':
            window.location.href = `${SITE_URL}/simyo`;
            return { status: 'redirecting', message: '正在跳转到 Simyo 工具页面' };
          default:
            return { status: 'error', message: '未知操作' };
        }
      }
    },
    {
      name: 'check-esim-compatibility',
      description: '检查设备是否支持 eSIM，提示用户在拨号盘输入 *#06# 查看 EID',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      async execute() {
        return {
          status: 'info',
          message: '请在手机拨号盘输入 *#06#，如显示 EID 号码则支持 eSIM',
          compatible_devices: {
            apple: 'iPhone XS/XR 及更新、iPhone SE 2 及更新',
            android: 'Samsung Galaxy S20+、Google Pixel 3+、部分 OnePlus/华为'
          }
        };
      }
    }
  ];

  // 注册 WebMCP 上下文
  try {
    navigator.modelContext.provideContext({
      name: 'eSIM Tools',
      description: 'Giffgaff 和 Simyo 的 eSIM 管理工具集',
      url: SITE_URL,
      tools
    });
    console.log('[WebMCP] 工具注册成功');
  } catch (err) {
    console.warn('[WebMCP] 注册失败:', err.message);
  }
})();
