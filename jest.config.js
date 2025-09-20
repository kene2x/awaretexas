module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'backend/**/*.js',
    'services/**/*.js',
    'models/**/*.js',
    'config/**/*.js',
    'frontend/js/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/tests/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  verbose: true,
  setupFiles: ['<rootDir>/tests/setup.js'],
  globals: {
    'process.env': {
      NODE_ENV: 'test'
    }
  },
  transformIgnorePatterns: [
    'node_modules/(?!(cheerio)/)'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  testTimeout: 30000,
  maxWorkers: 1
};