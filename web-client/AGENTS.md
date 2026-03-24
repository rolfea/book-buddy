# AGENTS.md - Frontend Intelligence (web-client/)

This file provides technical guidance for AI agents working on the Vanilla JS + Web Components frontend.

## Tech Stack
- **Architecture**: Vanilla JS + Custom Elements v1 (Web Components).
- **Build System**: **None** (Served directly as static assets).
- **Routing**: Hash-based (`#/login`, `#/books`, etc.).
- **Auth**: JWT in `localStorage` (`book_buddy_token`).
- **Tests**: Node.js built-in runner + `happy-dom`.

## Critical Commands
```bash
# Run tests (from web-client root)
npm install
npm test

# Run frontend (via Go server from repo root)
make build && go run server/cmd/server/main.go
# Access at http://localhost:8080
```

## Architecture Notes
- **Web Components**: No Shadow DOM used, except for `<isbn-scanner>` to isolate camera styles. Components are defined in `components/` and registered globally.
- **Routing**: `app.js` handles hash change events and renders the appropriate page from `pages/`.
- **API Communication**: `api.js` is a `fetch` wrapper that automatically injects the Bearer token and handles common error scenarios.

## Development Patterns
- **Imports**: Always use relative paths with `.js` extensions (e.g., `import { request } from "./api.js";`).
- **Component Lifecycle**: Use `connectedCallback()` for setup (like data fetching) and dispatch custom events for parent communication.
- **State Management**: Local component state, with `localStorage` for authentication state.

## Test Coverage
| File | Coverage |
|------|----------|
| `test/auth.test.js` | Token management (mocked localStorage) |
| `test/api.test.js` | Fetch wrapper (mocked fetch) |
| `test/book-card.test.js` | Rendering and event emission |
| `test/book-list.test.js` | List lifecycle and API integration |

*Note: `<isbn-scanner>` requires a real browser environment (BarcodeDetector API) and is not covered by happy-dom tests.*
