/**
 * Simyo 验证验证码
 * 验证验证码格式并返回成功信息
 */

const { withAuth, validateInput } = require('./_shared/middleware');

const verifyCodeSchema = {
  validationCode: {
    required: true,
    type: 'string',
    minLength: 6,
    maxLength: 6,
    pattern: /^\d{6}$/
  }
};

exports.handler = withAuth(async (event, context, { auth, body }) => {
  const { validationCode } = body;

  console.log('[simyo-verify-code] 验证验证码:', validationCode);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      result: {
        message: '验证码验证成功，设备更换申请已完成',
        status: 'VERIFIED',
        validationCode: validationCode,
        nextStep: '现在可以获取新的eSIM配置并生成二维码'
      }
    })
  };
}, { validateSchema: verifyCodeSchema });
