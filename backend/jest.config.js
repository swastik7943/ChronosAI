export default {
  testEnvironment: 'node',
  transform: {},
  verbose: true,
  testTimeout: 120000,
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: './tests/jest.globalSetup.js',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**'
  ],
  coverageDirectory: 'tests/coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
