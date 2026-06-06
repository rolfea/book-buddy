import { test, expect } from '@playwright/test';

const makeUniqueEmail = () => `testuser-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

test.describe('Routing & Outage Resilience', () => {
  
  test('should redirect unauthenticated guest users to login', async ({ page }) => {
    // 1. Attempt to access books page directly
    await page.goto('/#/books');
    await expect(page).toHaveURL(/.*#\/login/);

    // 2. Attempt to access scanner page directly
    await page.goto('/#/scanner');
    await expect(page).toHaveURL(/.*#\/login/);
  });

  test('should redirect authenticated users away from auth pages', async ({ page }) => {
    const email = makeUniqueEmail();
    const password = 'Password123!';

    // Register and login
    await page.goto('/#/register');
    await page.fill('auth-form[mode="register"] input[name="email"]', email);
    await page.fill('auth-form[mode="register"] input[name="password"]', password);
    await page.click('auth-form[mode="register"] button[type="submit"]');
    await expect(page).toHaveURL(/.*#\/books/);

    // Try to visit login while authenticated
    await page.goto('/#/login');
    await expect(page).toHaveURL(/.*#\/books/);

    // Try to visit register while authenticated
    await page.goto('/#/register');
    await expect(page).toHaveURL(/.*#\/books/);
  });

  test('should display service unreachable page if backend status check fails', async ({ page }) => {
    // Intercept status check and abort it to simulate backend outage
    await page.route('**/status', (route) => route.abort());

    // Navigate to root
    await page.goto('/');

    // Assert recovery page elements are rendered
    await expect(page.locator('.error-page h1')).toHaveText('Service Unreachable');
    await expect(page.locator('.error-page p')).toContainText('backend is currently offline');
    await expect(page.locator('.error-page button')).toHaveText('Retry');
  });
});
