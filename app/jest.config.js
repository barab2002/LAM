/**
 * Unit tests for pure TypeScript modules (gesture classifier, API client
 * logic). Component/UI behavior is exercised via the web build.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', types: ['jest', 'node'] } }],
  },
};
