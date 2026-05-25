import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  // Tests d'intégration sur DB réelle — exécution séquentielle obligatoire
  maxWorkers: 1,
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'src/modules/**/*.service.ts',
    'src/modules/**/*.repository.ts',
  ],
  coverageThreshold: {
    global: { lines: 70, statements: 70, functions: 70, branches: 60 },
  },
};

export default config;
