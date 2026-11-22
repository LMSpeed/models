import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.MODELS_SITE_TEST_URL ?? 'http://127.0.0.1:4177',
    trace: 'retain-on-failure',
  },
  webServer: process.env.MODELS_SITE_TEST_URL
    ? undefined
    : {
        command: 'pnpm --dir apps/site exec wrangler dev --local --port 4177',
        url: 'http://127.0.0.1:4177',
        reuseExistingServer: false,
        timeout: 60000,
      },
  reporter: [['list'], ['html', { open: 'never' }]],
});
