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
      env: {
        PORT: '8080',
        DATABASE_URL: 'postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable',
        JWT_SECRET: 'change_me_to_a_long_random_string_at_least_32_chars',
        JWT_EXPIRY_HOURS: '72',
        OPEN_LIBRARY_BASE_URL: 'https://openlibrary.org',
        SECURE_COOKIES: 'false',
        CORS_ALLOWED_ORIGINS: 'http://localhost:8081',
        APP_ENV: 'test',
      },
    },
    {
      command: 'node generate-config.mjs && npx http-server -p 8081',
      cwd: '../web-client',
      url: 'http://localhost:8081',
      reuseExistingServer: !process.env.CI,
      timeout: 15 * 1000,
      env: {
        APP_ENV: 'test',
      },
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
