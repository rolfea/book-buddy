import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 15000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'go run cmd/server/main.go',
      cwd: '../server',
      url: 'http://localhost:8080/status',
      reuseExistingServer: !process.env.CI,
      timeout: 15 * 1000,
    },
    {
      command: 'node generate-config.mjs && npx http-server -p 8081',
      cwd: '../web-client',
      url: 'http://localhost:8081',
      reuseExistingServer: !process.env.CI,
      timeout: 15 * 1000,
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
