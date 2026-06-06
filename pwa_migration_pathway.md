# Book Buddy - PWA Migration Pathway

This document provides a technical roadmap for converting Book Buddy's native ES module client into a Progressive Web App (PWA). This conversion enables offline access, local library caching, installation on mobile/desktop devices, and offline barcode scanning.

---

## 1. Architectural Strategy for PWA Conversion

Book Buddy's frontend is built as a pure Vanilla JS project with no compilation step (see [AGENTS.md](file:///home/eunoia/Code/book-buddy/AGENTS.md)). To preserve this "no-build" philosophy:
* **Vanilla Service Worker**: Write a clean, native JavaScript service worker (`sw.js`) without external bundlers like Workbox.
* **Native ES Modules**: Cache files directly using standard network caching APIs.
* **IndexedDB for Offline Storage**: Store the local book library and offline sync queue using native browser `indexedDB` or a lightweight, ES-module import of `idb` via CDN/vendor script.

---

## 2. Core PWA Components & Implementation Steps

### Step 1: Create the Web App Manifest
Create `manifest.json` in the frontend root ([web-client/manifest.json](file:///home/eunoia/Code/book-buddy/web-client/manifest.json)). This file provides metadata required by browsers to prompt installation.

```json
{
  "short_name": "BookBuddy",
  "name": "Book Buddy Library Manager",
  "description": "Scan and manage your personal book collection.",
  "icons": [
    {
      "src": "/images/icon-192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "/images/icon-512.png",
      "type": "image/png",
      "sizes": "512x512",
      "purpose": "any maskable"
    }
  ],
  "start_url": "/index.html",
  "background_color": "#121212",
  "theme_color": "#6200ee",
  "display": "standalone",
  "orientation": "portrait-primary"
}
```

### Step 2: Register the Service Worker in the App Bootstrapper
Modify [web-client/app.js](file:///home/eunoia/Code/book-buddy/web-client/app.js) to register the service worker upon page load:

```javascript
// Add to web-client/app.js under initialization
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker registered with scope: ', reg.scope);
    } catch (err) {
      console.error('ServiceWorker registration failed: ', err);
    }
  });
}
```

### Step 3: Implement the Service Worker (`sw.js`)
Create the Service Worker script (`sw.js`) in the root of the web-client. It will manage:
1. **Cache Installation**: Cache all essential static files (assets, templates, vanilla code files).
2. **Fetch Interception**: Apply specific caching strategies to different assets.

```javascript
const CACHE_NAME = 'bookbuddy-static-v1';
const DATA_CACHE_NAME = 'bookbuddy-data-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/api.js',
  '/auth.js',
  '/components/auth-form.js',
  '/components/book-card.js',
  '/components/book-list.js',
  '/components/isbn-scanner.js',
  '/pages/books.js',
  '/pages/login.js',
  '/pages/register.js',
  '/pages/scanner.js'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Interception Strategy
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1. API Calls: Network-First with Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.status === 200) {
            const resClone = res.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(e.request, resClone);
            });
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 2. Book Covers (OpenLibrary): Cache-First / Stale-While-Revalidate
  if (url.hostname.includes('openlibrary.org')) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        const fetchPromise = fetch(e.request).then((networkResponse) => {
          caches.open(DATA_CACHE_NAME).then((cache) => {
            cache.put(e.request, networkResponse.clone());
          });
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Static Assets: Cache-First
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
```

---

## 3. Offline Scanning & Synchronization (UX Optimizations)

A user scanning books in a low-reception area (e.g., cellars, bookshops) should have their additions synced automatically once they get back online.

### Step 4: Setup local IndexedDB storage
Since localStorage block sizes are small and synchronous (blocking UI operations), use **IndexedDB** to store book records and sync events locally.

Create a utility module `/web-client/db.js` to initialize the database:
```javascript
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bookbuddy_db', 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Object store for cached user book list
      db.createObjectStore('books', { keyPath: 'id' });
      // Object store for offline modification queue
      db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}
```

### Step 5: Queue Scans and Actions Offline
In `/web-client/api.js`, handle failed fetch actions (network connection errors) by caching the request locally.

```javascript
import { openDB } from './db.js';

export async function request(method, path, body) {
  // Check browser online status
  if (!navigator.onLine && method !== 'GET') {
    const db = await openDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    tx.objectStore('sync_queue').add({
      method,
      path,
      body,
      timestamp: Date.now()
    });
    await tx.complete;

    // Dispatch custom event to notify components that the action is queued
    window.dispatchEvent(new CustomEvent('offline-action-queued', { detail: { path } }));
    return { status: 'queued', offline: true };
  }

  // Regular online fetch code...
}
```

### Step 6: Synchronize Queue on Network Restoration
Add a listener in [app.js](file:///home/eunoia/Code/book-buddy/web-client/app.js) to fire a sync routine whenever the browser returns to an online state:

```javascript
async function syncOfflineData() {
  const db = await openDB();
  const tx = db.transaction('sync_queue', 'readwrite');
  const store = tx.objectStore('sync_queue');
  const getAllRequest = store.getAll();

  getAllRequest.onsuccess = async (e) => {
    const queue = e.target.result;
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        // Send queued actions using direct bypass network call
        await fetch('/api' + item.path, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            'X-BookBuddy-Request': 'true'
          },
          body: JSON.stringify(item.body)
        });
        
        // Remove from DB if successfully synced
        const deleteTx = db.transaction('sync_queue', 'readwrite');
        deleteTx.objectStore('sync_queue').delete(item.id);
      } catch (err) {
        console.error('Failed to sync item:', item, err);
        // Leave item in queue to retry later
      }
    }
  };
}

window.addEventListener('online', syncOfflineData);
```

---

## 4. Testing & Verification

1. **Simulate Offline Behavior**:
   * Open Chrome DevTools -> Application Panel -> Service Workers.
   * Tick the **Offline** checkbox and refresh the application to test caching.
2. **Verify Installation Prompt**:
   * Chrome DevTools -> Application Panel -> Manifest.
   * Verify all metadata resolves and click **Install App** to test integration.
3. **Lighthouse Validation**:
   * Open Lighthouse in DevTools.
   * Run a Progressive Web App report to verify all checklist requirements (Service worker active, maskable icons present, responsive design, etc.).
