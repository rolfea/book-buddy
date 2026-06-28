# AGENTS.md - Book Buddy Project Intelligence

This file serves as the primary technical reference and "init" state for AI agents working on the Book Buddy repository. It defines the project's architecture, technology stack, development workflows, and coding standards.

## Project Overview
Book Buddy is a personal book collection manager. It allows users to scan ISBNs using their device's camera, fetch book metadata (via OpenLibrary), and manage their personal library status (owned, wishlisted, or removed).

### Repository Structure
```
book-buddy/
├── server/          # Go REST API (Primary Backend)
├── web-client/      # Vanilla JS + Web Components (Primary Frontend)
├── archive/         # Archived React + TypeScript frontend (Deprecated)
├── plans/           # Architectural and feature plans
└── migrations/      # Database schema migrations (symlinked or referenced by server)
```

## Tech Stack

### Backend (server/)
- **Language**: Go 1.22+
- **Web Framework**: Standard library `net/http` with custom middleware chain.
- **Database**: PostgreSQL (v15+)
- **SQL Tooling**: `sqlc` for type-safe Go code generation from SQL.
- **Migrations**: `golang-migrate` (`migrate` CLI).
- **Authentication**: JWT (HMAC-SHA256) stored in `localStorage` on the client.
- **Dependencies**: `github.com/golang-jwt/jwt/v5`, `github.com/lib/pq`, `golang.org/x/crypto`.

### Frontend (web-client/)
- **Architecture**: Vanilla JavaScript, Web Components (Custom Elements v1).
- **Build System**: **None**. Native ES modules served directly by the Go server.
- **Routing**: Hash-based (`#/login`, `#/books`, etc.).
- **Camera/Scanning**: Barcode Detection API + `getUserMedia`.
- **Testing**: Node.js built-in test runner (`node:test`) + `happy-dom`.

## Critical Development Commands

### Infrastructure & Environment
```bash
# Start PostgreSQL via Docker
cd server && docker compose up -d

# Environment Setup
cp server/.env.example server/.env
# Update server/.env with a secure JWT_SECRET
```

### Backend Development
```bash
# Run migrations
migrate -path server/migrations -database "postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable" up

# Run the API server (serves frontend at http://localhost:8080)
go run server/cmd/server/main.go

# Generate DB code after editing SQL queries/schema
sqlc generate

# Run Go tests
go test ./server/...
```

### Frontend Development
```bash
# Install test dependencies (happy-dom)
cd web-client && npm install

# Run frontend tests
npm test
```

## Architectural Patterns

### Backend Layers (`server/internal/`)
1. **Controller**: HTTP handlers, request/response JSON mapping.
2. **Service**: Business logic, interface-based for testability.
3. **Data**: `Store` wrapper around `sqlc` queries with transaction support (`ExecTx`).

### Frontend Patterns (`web-client/`)
- **No Shadow DOM**: Most components use global CSS for simplicity, except `<isbn-scanner>`.
- **Component Communication**: Custom Events (e.g., `book-status-change`).
- **API Wrapper**: `api.js` centralizes fetch calls and Bearer token injection.

## Coding Standards & Rules

### Test-Driven Development (TDD) & Red-Green-Refactor Workflow
All future features, bug fixes, or behavioral changes implemented by agents working in this repository MUST strictly follow the **Red-Green-Refactor** development workflow:
1. **Red (Failing Stage)**: Write a failing unit, integration, or E2E test that describes the new feature or captures the regression bug *before* making any logic changes. Run the test suite and confirm that the test fails.
   - *E2E context*: For complex client-server user journeys (e.g., session flow redirections, scanning flow alerts, or PWA offline sync), root-level E2E specs in `e2e/` can and should compose part of the "Red" tests.
   - *Unit/Integration context*: For standalone backend services, query wrappers, or pure frontend functions, write failing unit tests in `server/` (`*_test.go`) or `web-client/test/` to serve as the initial fail baseline.
2. **Green (Passing Stage)**: Implement the minimum amount of functional code necessary to make the new test pass. Do not write unneeded code.
3. **Refactor (Clean-up Stage)**: Refactor and clean up the implementation (remove redundancy, optimize DB transactions, resolve lints) while maintaining all test suite assertions as passing.

### Go Standards
- Prefer standard library over external frameworks.
- Use `sqlc` for all database interactions; do not hand-write DB access code in the `query` package.
- Services MUST return sentinel errors (e.g., `ErrNotFound`) mapped to HTTP codes in controllers.
- New features require corresponding tests in `*_test.go`.

### JavaScript Standards
- Use native ES module imports with explicit `.js` extensions.
- Maintain "no build step" philosophy; do not introduce transpilers or bundlers to the active `web-client`.
- Components should be registered in `components/*.js` and used as custom tags in pages or the main app.

### Safe HTML Construction & DOM Standards
To satisfy our security linters (`eslint-plugin-no-unsanitized`) and prevent DOM-based XSS:
- **Prefer `textContent` for Text**: Never use `innerHTML` to set plain text. Always use `.textContent` or `.innerText` to ensure browser-level escaping.
  - *Incorrect*: `el.innerHTML = "<span>" + username + "</span>";`
  - *Correct*: `el.textContent = username;`
- **Programmatic Element Construction**: For complex dynamic elements, construct nodes programmatically using standard DOM APIs:
  ```javascript
  const card = document.createElement("div");
  card.className = "book-card";
  const title = document.createElement("h3");
  title.textContent = book.title;
  card.appendChild(title);
  ```
- **Routing & Dynamic Views**: Do not parse or inject dynamic URLs or hashes into the DOM as raw strings. Resolve them via strict static white-lists mapping hashes to programmatically instantiated component tags.
- **Escaping Linter Warnings (Static Templates only)**: If you are assigning a purely static HTML template literal with no dynamic variable injection, you may use a linter override comment, but only after verification:
  ```javascript
  // eslint-disable-next-line no-unsanitized/property
  this.innerHTML = `<form><input type="email" required /></form>`;
  ```

### Security Standards & Automated Checks
- **Static Analysis (JS)**: The `web-client` project uses ESLint with `eslint-plugin-security` and `eslint-plugin-no-unsanitized` to prevent security hotspots (e.g., regex injections) and DOM-based Cross-Site Scripting (XSS).
  - Use `npm run lint` in `web-client/` to run the full linter suite.
  - Avoid assigning raw inputs directly to `innerHTML`. Prefer safe DOM APIs (like `textContent` or `element.setAttribute`) or sanitize inputs explicitly.
- **Static Analysis (Go)**: Use `gosec` to scan for backend security concerns like SQL injection, unsafe cryptography, or hardcoded credentials.
  - To scan Go files: run `$(go env GOPATH)/bin/gosec ./server/...` (install via `go install github.com/securego/gosec/v2/cmd/gosec@latest`).
- **Git Hooks**: Pre-commit verification is automated using Husky (`web-client/.husky/pre-commit`), which runs `npm run lint` before commits are accepted. Always fix critical security errors.

## Database Schema
- **users**: Authentication and identity.
- **books**: Global book metadata (ISBN, Title, Author, Cover URL).
- **user_books**: Join table linking users to books with `status` (`owned`, `wishlisted`, `removed`).
