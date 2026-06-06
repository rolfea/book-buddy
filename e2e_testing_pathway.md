# Book Buddy - End-to-End (E2E) Testing Pathway

This document outlines the architectural plan for implementing automated End-to-End (E2E) testing in Book Buddy using **Playwright**. E2E tests will run against a live local instance of the Go server and the web client to verify user-facing functionality and complement our unit tests.

---

## 1. Why Playwright?

Playwright is chosen over alternatives (Cypress, Selenium) for the following reasons:
1. **Multi-Browser support**: Runs tests natively in chromium, webkit (Safari), and firefox.
2. **First-Class Offline Simulation**: Playwright provides `context.setOffline(true)` to programmatically trigger offline states, which is critical for testing our PWA service worker and offline IndexedDB behavior.
3. **WebAuthn / Passkey Emulation**: Playwright supports FIDO2/WebAuthn virtual authenticators for automated passkey sign-ins.
4. **Camera / Video Injection**: Allows injecting virtual camera video files (`.y4m` format) into the browser context to simulate live barcode scanning.
5. **No Build Step Required**: Playwright test runner compiles TS/JS on the fly, keeping the core client workspace clean and code-delivery simple.

---

## 2. Testing Architecture & Setup

### Directory Layout
Add the E2E infrastructure to the client directory:
```
book-buddy/
├── web-client/
│   ├── e2e/                     # Playwright test specs
│   │   ├── auth.spec.js         # Login, registration, session checks
│   │   ├── library.spec.js      # Book list, status update, deletion
│   │   ├── scanner.spec.js      # Camera scanning emulation
│   │   └── pwa.spec.js          # Offline mode, service worker caching
│   ├── playwright.config.js     # Playwright configuration
│   └── package.json             # Updated with playwright devDependencies
```

### Installation
Add the necessary packages to the [web-client/package.json](file:///home/eunoia/Code/book-buddy/web-client/package.json) devDependencies:
```bash
cd web-client
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

### Configuration (`playwright.config.js`)
Create a Playwright configuration file in [web-client/playwright.config.js](file:///home/eunoia/Code/book-buddy/web-client/playwright.config.js) that starts the Go server automatically before running tests:

```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false, // Turn off parallel testing if using a single sqlite/postgres test db
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Automatically spin up the Go backend server before testing
  webServer: {
    command: 'go run ../server/cmd/server/main.go',
    url: 'http://localhost:8080/status',
    reuseExistingServer: !process.env.CI,
    timeout: 10 * 1000,
    env: {
      PORT: '8080',
      DATABASE_URL: 'postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy_test?sslmode=disable',
      ENVIRONMENT: 'test',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

---

## 3. High-Value Test Scenarios

### Scenario A: Authentication Flows (`auth.spec.js`)
Verify basic credentials entry and state transition:
- Registration with unique emails.
- Login with correct credentials redirects to `#/books`.
- Login with invalid credentials displays a visible error banner.
- Logout redirects to `#/login` and clears active credentials.

### Scenario B: Library Management & CRUD (`library.spec.js`)
Test library state modifications (Owned, Wishlist, Deleted):
- Adding a book manually or via mock lookup.
- Transitioning book status: clicking "Mark Owned" updates the state.
- Deleting a book: clicking "Remove" drops it from the list.

### Scenario C: Camera & Scanning Emulation (`scanner.spec.js`)
Use Playwright's launch configuration to bypass permission prompts and inject a virtual camera showing a barcode:

```javascript
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      // Pass a Y4M/MJPEG video of a barcode being scanned
      `--use-file-for-fake-video-capture=${path.resolve('e2e/assets/barcode_scan.y4m')}`
    ]
  }
});

test('Should scan barcode and add book', async ({ page }) => {
  await page.goto('/#/login');
  // Perform login ...
  
  await page.goto('/#/scanner');
  // Wait for the barcode detection to fire and verify success HUD is visible
  await expect(page.locator('.success-hud')).toBeVisible({ timeout: 10000 });
  await page.goto('/#/books');
  await expect(page.locator('.book-card')).toHaveCount(1);
});
```

### Scenario D: PWA Offline and Sync (`pwa.spec.js`)
This flow simulates internet disconnection to verify offline PWA caching:

```javascript
test('Should cache books and support offline scan queues', async ({ page, context }) => {
  await page.goto('/#/login');
  // Login ...
  await page.goto('/#/books');

  // Go Offline
  await context.setOffline(true);
  
  // Refresh while offline (verifying service worker serves assets)
  await page.reload();
  await expect(page.locator('h1')).toContainText('My Books');

  // Simulate scanning a book offline (will trigger offline queueing)
  // [IndexedDB insertion validation]

  // Go Online
  await context.setOffline(false);
  
  // Wait for background sync to trigger and empty the sync queue
  // Check that the book now exists on the backend server database
});
```

---

## 4. Continuous Integration (CI) Integration

Add a GitHub Action workflow to automate these checks on push or pull requests:

```yaml
# .github/workflows/e2e.yml
name: Playwright E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Start PostgreSQL Database
        run: |
          docker compose -f server/docker-compose.yml up -d
          # Wait for PostgreSQL to boot
          until docker exec $(docker ps -q -f name=postgres) pg_isready; do sleep 1; done

      - name: Run Database Migrations
        run: |
          # Install golang-migrate and run up migration ...

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: web-client/package.json

      - name: Install dependencies
        run: |
          cd web-client
          npm ci
          npx playwright install --with-deps chromium

      - name: Run E2E Tests
        run: |
          cd web-client
          npx playwright test
```
