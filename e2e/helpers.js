import { expect } from '@playwright/test';
import { ROUTES as CLIENT_ROUTES } from '../web-client/routes.js';

/**
 * Centralized routes mapping to prevent brittle URL hardcoding in tests.
 */
export const ROUTES = {
  login: '#' + CLIENT_ROUTES.login,
  register: '#' + CLIENT_ROUTES.register,
  books: '#' + CLIENT_ROUTES.books,
  scanner: '#' + CLIENT_ROUTES.scanner,
};

/**
 * Generates a unique email for test isolation.
 * @returns {string}
 */
export const makeUniqueEmail = () => `testuser-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

/**
 * Directs the browser to register a new user and asserts successful redirection.
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function registerUser(page, email, password) {
  await page.goto(ROUTES.register);
  await page.fill('auth-form[mode="register"] input[name="email"]', email);
  await page.fill('auth-form[mode="register"] input[name="password"]', password);
  await page.click('auth-form[mode="register"] button[type="submit"]');
  await expect(page).toHaveURL(new RegExp(ROUTES.books));
}

/**
 * Directs the browser to log in an existing user and asserts successful redirection.
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function loginUser(page, email, password) {
  await page.goto(ROUTES.login);
  await page.fill('auth-form[mode="login"] input[name="email"]', email);
  await page.fill('auth-form[mode="login"] input[name="password"]', password);
  await page.click('auth-form[mode="login"] button[type="submit"]');
  await expect(page).toHaveURL(new RegExp(ROUTES.books));
}

/**
 * Registers a user via direct background API request to bypass UI form filling.
 * The session token is read from the response and explicitly injected into the browser context.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function registerUserViaAPI(request, page, email, password) {
  const res = await request.post('http://localhost:8080/api/auth/register', {
    data: { email, password },
    headers: {
      'X-BookBuddy-Request': 'true',
    },
  });
  if (!res.ok()) {
    throw new Error(`API registration failed: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  await page.context().addCookies([{
    name: 'token',
    value: data.token,
    domain: 'localhost',
    path: '/',
  }]);
}


