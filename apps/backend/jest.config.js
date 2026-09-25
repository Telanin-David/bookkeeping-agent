/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/test-setup.ts'],
  coverageThreshold: {
    global: { lines: 80 },
  },
};
