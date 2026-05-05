/**
 * Jest 测试框架配置
 */

module.exports = {
  // 测试环境
  testEnvironment: 'jsdom',

  // 覆盖率提供器：使用 V8 替代 babel-plugin-istanbul（兼容 Node.js 22+）
  coverageProvider: 'v8',

  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/__tests__/**/*.js'
  ],

  // 忽略的文件/目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/netlify/',
    '/.netlify/'
  ],

  // 覆盖率收集
  collectCoverageFrom: [
    'src/js/modules/**/*.js',
    '!src/js/modules/**/*.test.js',
    '!src/js/modules/**/*.spec.js',
    '!**/node_modules/**',
    '!**/dist/**'
  ],

  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],

  // 覆盖率阈值（逐步提升：当前 34% statements，目标 60%）
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 65,
      lines: 30,
      statements: 30
    }
  },

  // 模块名映射
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },

  // 转换器配置
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // 详细输出
  verbose: true,

  // 清除模拟
  clearMocks: true,

  // 恢复模拟
  restoreMocks: true
};