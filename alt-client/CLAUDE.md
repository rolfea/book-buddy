# CLAUDE.md — alt-client

Vanilla JS + Web Components client for Book Buddy. **No build step** — files are served directly as static assets by the Go server.

## Running

```bash
# From the repo root — Go server serves both the API and alt-client static files
cd server
go run ./cmd/server/main.go
# Open http://localhost:8080
```

The Go server uses `http.FileServer` on `"/"` as a catch-all, pointing at `../alt-client`. All real API routes have method-specific patterns (`GET /user/books`, etc.) and take precedence.

## Tests

Uses Node's built-in test runner (`node:test`) + `happy-dom` for DOM tests. No bundler involved.

```bash
cd alt-client
npm install        # installs happy-dom (dev only)
npm test           # node --test, auto-discovers test/*.test.js
```

**What is tested:**

| File | What's covered |
|------|----------------|
| `test/auth.test.js` | `getToken`, `setToken`, `clearToken`, `isLoggedIn` — mocked localStorage |
| `test/api.test.js` | `request()` — header injection, body serialization, error handling, 204 handling — mocked `fetch` |
| `test/book-card.test.js` | Rendering, button visibility rules, custom event emission, HTML escaping |
| `test/book-list.test.js` | API call on mount, empty/error states, PATCH/DELETE on events, list reload after mutation |

**What is NOT tested:**

- `isbn-scanner.js` — depends on `BarcodeDetector`, `getUserMedia`, and `ImageCapture`, which require a real browser. Cover with Playwright or manual testing.
- `pages/*.js` — thin wrappers with no logic.
- `app.js` router — hash routing side-effects are better exercised with E2E tests.

## File structure

```
alt-client/
├── index.html              # shell; loads app.js as type="module"
├── styles.css              # global styles
├── app.js                  # hash router + nav rendering
├── auth.js                 # getToken / setToken / clearToken / isLoggedIn (localStorage)
├── api.js                  # request(method, path, body?) — fetch wrapper with Bearer token
├── components/
│   ├── auth-form.js        # <auth-form mode="login|register"> — calls /auth/*
│   ├── book-list.js        # <book-list> — fetches GET /user/books, handles PATCH/DELETE events
│   ├── book-card.js        # <book-card> — emits book-status-change, book-delete
│   └── isbn-scanner.js     # <isbn-scanner> (Shadow DOM) — camera → BarcodeDetector → isbn-detected
├── pages/
│   ├── login.js            # render(container) → <auth-form mode="login">
│   ├── register.js         # render(container) → <auth-form mode="register">
│   ├── books.js            # render(container) → <book-list>
│   └── scanner.js          # render(container) → <isbn-scanner>; wires isbn-detected → POST /user/books
└── test/
    ├── auth.test.js
    ├── api.test.js
    ├── book-card.test.js
    └── book-list.test.js
```

## Architecture notes

- **Routing**: hash-based (`#/login`, `#/register`, `#/books`, `#/scanner`). Unrecognised hashes fall back to `#/login`. Auth-required routes redirect to `#/login` when no token is present.
- **Web Components**: Custom Elements v1, no Shadow DOM except `<isbn-scanner>` (camera UI benefits from style isolation). Components are defined in `components/` and registered via `customElements.define()` at module load time.
- **Auth**: JWT stored in `localStorage` under key `book_buddy_token`. `api.js` reads it on every request and injects `Authorization: Bearer <token>`.
- **No bundler**: imports use relative paths with `.js` extensions. `import` / `export` work natively in the browser because `index.html` loads `app.js` as `type="module"`.

## API surface

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | — | `{email, password}` → `{token}` |
| POST | `/auth/login` | — | `{email, password}` → `{token}` |
| GET | `/user/books` | Bearer | list user's books |
| POST | `/user/books` | Bearer | `{books: [{isbn, title, author, cover_url, status}]}` |
| PATCH | `/user/books` | Bearer | `{user_book_id, status, removal_reason?}` |
| DELETE | `/user/books` | Bearer | `{user_book_id}` → 204 |

`status` values: `owned`, `wishlisted`, `removed` (`removal_reason` is required when status is `removed`).
