import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'sdk/javascript/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage/tests',
      include: ['packages/core/src/**/*.ts', 'sdk/javascript/src/**/*.ts'],
      thresholds: { branches: 70 },
    },
  },
});
