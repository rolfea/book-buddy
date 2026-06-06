import { test, expect } from '@playwright/test';

const makeUniqueEmail = () => `testuser-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

test.describe('Camera & Barcode Scanner Emulation', () => {
  let email;
  const password = 'Password123!';

  test.beforeEach(async ({ page }) => {
    email = makeUniqueEmail();

    // 1. Inject canvas stream and BarcodeDetector mocks before page loads
    await page.addInitScript(() => {
      // Create a real MediaStream from a dummy canvas to prevent browser srcObject errors
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      // Draw flashing noise to keep video track active
      setInterval(() => {
        ctx.fillStyle = Math.random() > 0.5 ? '#111' : '#222';
        ctx.fillRect(0, 0, 640, 480);
      }, 100);

      const fakeStream = canvas.captureStream(30);
      
      // Override getUserMedia
      navigator.mediaDevices.getUserMedia = async () => fakeStream;

      // Mock BarcodeDetector API
      class MockBarcodeDetector {
        constructor(options) {
          this.options = options;
        }
        async detect(image) {
          // If a mock value has been queued by the test script, return it
          if (window.__mockBarcodeValue) {
            const val = window.__mockBarcodeValue;
            window.__mockBarcodeValue = null; // Consume the value
            return [{ rawValue: val, format: 'ean_13' }];
          }
          return [];
        }
      }
      window.BarcodeDetector = MockBarcodeDetector;
    });

    // 2. Register and Login to start fresh
    await page.goto('/#/register');
    await page.fill('auth-form[mode="register"] input[name="email"]', email);
    await page.fill('auth-form[mode="register"] input[name="password"]', password);
    await page.click('auth-form[mode="register"] button[type="submit"]');
    await expect(page).toHaveURL(/.*#\/books/);
  });

  test('should initialize scanner, auto-detect barcode, display success HUD, and list book', async ({ page }) => {
    // 1. Visit scanner view
    await page.goto('/#/scanner');
    await expect(page.locator('h1')).toHaveText('Scanner View');

    // 2. Verify status text confirms scanning is active
    const scannerStatus = page.locator('isbn-scanner #status');
    await expect(scannerStatus).toHaveText('Scanning for barcodes...');

    // 3. Queue up a fake barcode to be picked up by the auto-scan loop
    const isbn = '9780596520687'; // "Using SQLite" ISBN or similar
    await page.evaluate((mockIsbn) => {
      window.__mockBarcodeValue = mockIsbn;
    }, isbn);

    // 4. Verify that the scanning UI shows success overlayHUD and scans are saved
    const overlayTitle = page.locator('isbn-scanner .overlay-title');
    await expect(overlayTitle).toHaveText('Added to Library!', { timeout: 10000 });

    // 5. Verify it appears in the session history list on the scanner page
    const scannedItem = page.locator('.scanned-book-item');
    await expect(scannedItem).toBeVisible();
    await expect(scannedItem.locator('.book-isbn')).toHaveText(isbn);
    await expect(scannedItem.locator('.scan-status')).toHaveText('Saved');

    // 6. Navigate to Books list and verify the book is in our library
    await page.click('#btn-go-books');
    await expect(page).toHaveURL(/.*#\/books/);
    
    const bookCard = page.locator('book-card');
    await expect(bookCard).toBeVisible();
    await expect(bookCard.locator('.isbn')).toHaveText(isbn);
    await expect(bookCard.locator('.status')).toHaveText('wishlisted');
  });
});
