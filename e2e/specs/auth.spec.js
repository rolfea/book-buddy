import { test, expect } from '@playwright/test';
import { makeUniqueEmail, registerUser, loginUser, ROUTES } from '../helpers.js';

test.describe('Authentication Flow', () => {
  test('should register a new user, redirect to books page, and allow logging out', async ({ page }) => {
    const testEmail = makeUniqueEmail();
    const testPassword = 'Password123!';

    // Register user using shared helper
    await registerUser(page, testEmail, testPassword);

    // Verify My Books view details
    await expect(page.locator('h1')).toHaveText('My Books');

    // Assert navigation elements are visible
    const nav = page.locator('#nav');
    await expect(nav.locator('a[href="#/books"]')).toBeVisible();
    await expect(nav.locator('a[href="#/scanner"]')).toBeVisible();

    // Logout
    await page.click('#logout-btn');

    // Assert redirection back to login
    await expect(page).toHaveURL(new RegExp(ROUTES.login));
    await expect(page.locator('h1')).toHaveText('Login');
  });

  test('should log in successfully with an existing user', async ({ page }) => {
    const testEmail = makeUniqueEmail();
    const testPassword = 'Password123!';

    // 1. Register a user first
    await registerUser(page, testEmail, testPassword);

    // 2. Log out
    await page.click('#logout-btn');
    await expect(page).toHaveURL(new RegExp(ROUTES.login));

    // 3. Log back in using shared loginUser helper
    await loginUser(page, testEmail, testPassword);
    await expect(page.locator('h1')).toHaveText('My Books');
  });

  test('should fail to login with wrong credentials and display error message', async ({ page }) => {
    await page.goto(ROUTES.login);
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
