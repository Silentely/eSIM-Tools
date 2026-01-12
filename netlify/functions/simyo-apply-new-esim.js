/**
 * Simyo 申请新 eSIM（设备更换）
 * 返回提示信息，引导用户在 APP 中操作
 */

const { withAuth } = require('./_shared/middleware');

exports.handler = withAuth(async (event, context, { auth }) => {
  console.log('[simyo-apply-new-esim] 申请新eSIM（设备更换）');

  // 这个功能需要在 Simyo APP 中完成
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      result: {
        message: '请在Simyo APP中申请更换设备/eSIM，填写验证码后进入下一界面但不要继续操作，然后返回此工具继续',
        status: 'PENDING_APP_OPERATION',
        nextStep: '在APP中操作完成后，请点击"发送验证码到短信"或直接输入从客服获取的验证码'
      }
    })
  };
});
