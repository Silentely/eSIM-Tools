/**
 * Simyo 发送短信验证码
 * 返回提示信息
 */

const { withAuth } = require('./_shared/middleware');

exports.handler = withAuth(async (event, context, { auth }) => {
  console.log('[simyo-send-sms-code] 发送验证码到短信');

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      result: {
        message: '验证码已发送到您的手机，请查收短信',
        status: 'SMS_SENT',
        nextStep: '请在下方输入收到的6位数字验证码'
      }
    })
  };
});
