import { test, expect } from '@playwright/test';

// Helper to generate unique email for test isolation
const makeUniqueEmail = () => `testuser-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

test.describe('Authentication Flow', () => {
  test('should register a new user, redirect to books page, and allow logging out', async ({ page }) => {
    const testEmail = makeUniqueEmail();
    const testPassword = 'Password123!';

    // 1. Visit registration page
    await page.goto('/#/register');
    await expect(page.locator('h1')).toHaveText('Create an Account');

    // 2. Fill registration details
    await page.fill('auth-form[mode="register"] input[name="email"]', testEmail);
    await page.fill('auth-form[mode="register"] input[name="password"]', testPassword);
    await page.click('auth-form[mode="register"] button[type="submit"]');

    // 3. Assert redirection to books page
    await expect(page).toHaveURL(/.*#\/books/);
    await expect(page.locator('h1')).toHaveText('My Books');

    // 4. Assert navigation elements are visible
    const nav = page.locator('#nav');
    await expect(nav.locator('a[href="#/books"]')).toBeVisible();
    await expect(nav.locator('a[href="#/scanner"]')).toBeVisible();

    // 5. Logout
    await page.click('#logout-btn');

    // 6. Assert redirection back to login
    await expect(page).toHaveURL(/.*#\/login/);
    await expect(page.locator('h1')).toHaveText('Login');
  });

  test('should fail to login with wrong credentials and display error message', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.locator('h1')).toHaveText('Login');

    // Attempt login with invalid user
    await page.fill('auth-form[mode="login"] input[name="email"]', 'wrong-user@example.com');
    await page.fill('auth-form[mode="login"] input[name="password"]', 'WrongPassword1!');
    await page.click('auth-form[mode="login"] button[type="submit"]');

    // Assert error message is shown
    const errorEl = page.locator('auth-form[mode="login"] .error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).not.toBeEmpty();
  });
});
