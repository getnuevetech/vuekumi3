import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 45 — thin web smoke against a seeded local stack.
 * API contract coverage stays in apps/api tests; these only check critical UI paths.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm exec -w @vuekumi/api -- tsx src/index.ts',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: '3001',
        NODE_ENV: 'development',
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://vuekumi:vuekumi@localhost:5432/vuekumi',
        JWT_SECRET: process.env.JWT_SECRET ?? 'ci-jwt-secret-not-for-production-use',
        COOKIE_SECRET: process.env.COOKIE_SECRET ?? 'ci-cookie-secret-not-for-production',
        WEB_URL: 'http://127.0.0.1:3000',
      },
    },
    {
      command: 'npm exec -w @vuekumi/web -- vite --host 127.0.0.1 --port 3000',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
