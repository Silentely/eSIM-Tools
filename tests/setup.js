/**
 * Jest 测试设置文件
 */
import { randomBytes } from 'crypto';

// 导入 Jest DOM 扩展
import '@testing-library/jest-dom';

// 设置全局测试超时
jest.setTimeout(10000);

// 模拟 localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// 模拟 sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// 模拟 fetch API
global.fetch = jest.fn();

// 模拟 crypto API（提供 webcrypto.subtle 接口）
// getRandomValues 使用 Node CSPRNG 填充，避免测试环境引入不安全的随机源
const webcryptoMock = {
  getRandomValues: (arr) => {
    arr.set(randomBytes(arr.length));
    return arr;
  },
  subtle: {
    digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32)))
  }
};
global.crypto = webcryptoMock;
globalThis.crypto = webcryptoMock;
if (typeof window !== 'undefined') {
  window.crypto = webcryptoMock;
}

// 模拟 navigator.clipboard
global.navigator.clipboard = {
  writeText: jest.fn(() => Promise.resolve()),
  readText: jest.fn(() => Promise.resolve(''))
};

// 模拟 IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
};

// 模拟 Service Worker
global.navigator.serviceWorker = {
  register: jest.fn(() => Promise.resolve({
    installing: null,
    waiting: null,
    active: null,
    addEventListener: jest.fn()
  }))
};

// Polyfill: TextEncoder（Node 环境下用于 PKCE 生成）
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder } = require('util');
  global.TextEncoder = TextEncoder;
}

// Polyfill: document.execCommand（降级复制方案）
if (typeof document.execCommand === 'undefined') {
  document.execCommand = jest.fn(() => true);
}

// 清理每个测试后的模拟
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});