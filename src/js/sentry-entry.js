/**
 * Sentry SDK 入口文件
 * 使用 npm 安装的 @sentry/browser 构建完整 bundle
 * 替代旧的手动 vendor bundle
 */

import {
  init,
  browserTracingIntegration,
  replayIntegration,
  feedbackIntegration,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  setTag,
  setContext,
  withScope,
  showReportDialog,
  getGlobalScope,
  flush,
  close,
} from '@sentry/browser';

// 暴露到 window 供 sentry-loader.js 和其他模块使用
if (typeof window !== 'undefined') {
  window.Sentry = {
    init,
    browserTracingIntegration,
    replayIntegration,
    feedbackIntegration,
    captureException,
    captureMessage,
    addBreadcrumb,
    setUser,
    setTag,
    setContext,
    withScope,
    showReportDialog,
    getGlobalScope,
    flush,
    close,
  };

  // 触发事件通知 SDK 已加载
  window.dispatchEvent(new Event('sentry-sdk-loaded'));
}

export {
  init,
  browserTracingIntegration,
  replayIntegration,
  feedbackIntegration,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  setTag,
  setContext,
  withScope,
  showReportDialog,
  getGlobalScope,
  flush,
  close,
};
