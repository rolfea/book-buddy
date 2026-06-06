import { test, expect } from '@playwright/test';

const makeUniqueEmail = () => `testuser-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

test.describe('Library Management Flow', () => {
  let email;
  const password = 'Password123!';

  test.beforeEach(async ({ page }) => {
    email = makeUniqueEmail();
    
    // Register and login before each test to have an empty library
    await page.goto('/#/register');
    await page.fill('auth-form[mode="register"] input[name="email"]', email);
    await page.fill('auth-form[mode="register"] input[name="password"]', password);
    await page.click('auth-form[mode="register"] button[type="submit"]');
    await expect(page).toHaveURL(/.*#\/books/);
  });

  test('should display empty state, add a book via simulated scan, change its status, and delete it', async ({ page }) => {
    // 1. Verify empty state on books list page
    const emptyStateText = page.locator('book-list');
    await expect(emptyStateText).toContainText('No books yet');

    // 2. Navigate to scanner page
    await page.goto('/#/scanner');
    await expect(page.locator('h1')).toHaveText('Scanner View');

    // 3. Dispatch mock ISBN detection event on <isbn-scanner>
    const isbn = '9780596520687'; // "Using SQLite" ISBN or similar
    await page.evaluate((detectedIsbn) => {
      const scanner = document.getElementById('book-scanner');
      scanner.dispatchEvent(new CustomEvent('isbn-detected', {
        detail: { isbn: detectedIsbn }
      }));
    }, isbn);

    // 4. Wait for item to appear in session scanned history list and be marked as "Saved"
    const scannedHistoryItem = page.locator('.scanned-book-item');
    await expect(scannedHistoryItem).toBeVisible({ timeout: 10000 });
    await expect(scannedHistoryItem.locator('.book-isbn')).toHaveText(isbn);
    await expect(scannedHistoryItem.locator('.scan-status')).toHaveText('Saved');

    // 5. Navigate back to Books page
    await page.click('#btn-go-books');
    await expect(page).toHaveURL(/.*#\/books/);

    // 6. Verify book card is rendered in the list
    const bookCard = page.locator('book-card');
    await expect(bookCard).toBeVisible();
    await expect(bookCard.locator('.isbn')).toHaveText(isbn);
    
    // Default scanned status is "wishlisted"
    await expect(bookCard.locator('.status')).toHaveText('wishlisted');

    // 7. Click "Mark Owned"
    await bookCard.locator('button[data-action="owned"]').click();
    
    // Status text should change to "owned"
    await expect(bookCard.locator('.status')).toHaveText('owned');
    // "Mark Owned" button should disappear (since status is now owned)
    await expect(bookCard.locator('button[data-action="owned"]')).not.toBeVisible();

    // 8. Remove the book
    await bookCard.locator('button[data-action="delete"]').click();

    // 9. Verify library goes back to empty state
    await expect(emptyStateText).toContainText('No books yet');
  });

  test('should escape HTML in book titles and authors to prevent DOM-based XSS', async ({ page }) => {
    const maliciousTitle = '<script>window.xss=true;</script><img src=x onerror="window.xss=true">';
    const maliciousAuthor = '<b>Unescaped Author</b>';
    const fakeIsbn = 'fake-isbn-xss-999';

    // 1. Force add the book with malicious metadata directly via POST /api/user/books inside browser context
    await page.evaluate(async (params) => {
      const baseUrl = window.API_BASE_URL || '';
      const res = await fetch(baseUrl + '/api/user/books', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-BookBuddy-Request': 'true'
        },
        body: JSON.stringify({
          books: [{
            isbn: params.isbn,
            title: params.title,
            author: params.author,
            status: 'wishlisted'
          }]
        })
      });
      if (!res.ok) {
        throw new Error(`API fetch failed with status ${res.status}`);
      }
    }, { isbn: fakeIsbn, title: maliciousTitle, author: maliciousAuthor });

    // 2. Refresh page and confirm we are on the books view
    await page.reload();
    const bookCard = page.locator('book-card');
    await expect(bookCard).toBeVisible();

    // 3. Assert HTML renders safely as plain text instead of parsing as DOM nodes
    await expect(bookCard.locator('.title')).toHaveText(maliciousTitle);
    await expect(bookCard.locator('.author')).toHaveText(maliciousAuthor);

    // 4. Assert that no scripts executed (window.xss remains undefined)
    const hasXssRun = await page.evaluate(() => typeof window.xss !== 'undefined');
    expect(hasXssRun).toBe(false);
  });
});
