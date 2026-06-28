import { test, expect } from '@playwright/test';
import { makeUniqueEmail, registerUser, ROUTES } from '../helpers.js';

test.describe('Routing & Outage Resilience', () => {
  
  test('should redirect unauthenticated guest users to login', async ({ page }) => {
    // 1. Attempt to access books page directly
    await page.goto(ROUTES.books);
    await expect(page).toHaveURL(new RegExp(ROUTES.login));

    // 2. Attempt to access scanner page directly
    await page.goto(ROUTES.scanner);
    await expect(page).toHaveURL(new RegExp(ROUTES.login));
  });

  test('should redirect authenticated users away from auth pages', async ({ page }) => {
    const email = makeUniqueEmail();
    const password = 'Password123!';

    // Register and login using helper
    await registerUser(page, email, password);

    // Try to visit login while authenticated
    await page.goto(ROUTES.login);
    await expect(page).toHaveURL(new RegExp(ROUTES.books));

    // Try to visit register while authenticated
    await page.goto(ROUTES.register);
    await expect(page).toHaveURL(new RegExp(ROUTES.books));
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
