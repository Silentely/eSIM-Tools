'use strict';

const { AuthError } = require('./middleware');

/**
 * 构建内部函数互调所需的请求头
 * - 仅通过 Header 传递内部密钥，避免 URL / Body 泄漏
 * - 若 ACCESS_KEY 未配置则抛出 500 错误
 */
function getInternalHeaders() {
  if (!process.env.ACCESS_KEY) {
    throw new AuthError('ACCESS_KEY 未配置', 500);
  }
  return {
    'Content-Type': 'application/json',
    'x-esim-key': process.env.ACCESS_KEY
  };
}

module.exports = { getInternalHeaders };
