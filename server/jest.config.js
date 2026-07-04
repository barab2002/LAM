/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  globalSetup: '<rootDir>/test/globalSetup.js',
  setupFiles: ['<rootDir>/test/setupEnv.js'],
  testTimeout: 30000,
};
