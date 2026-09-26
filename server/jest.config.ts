import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['\\.unit\\.test\\.ts$'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/__tests__/**',
    '!src/server.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
};

export default config;
