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

### Go Standards
- Prefer standard library over external frameworks.
- Use `sqlc` for all database interactions; do not hand-write DB access code in the `query` package.
- Services MUST return sentinel errors (e.g., `ErrNotFound`) mapped to HTTP codes in controllers.
- New features require corresponding tests in `*_test.go`.

### JavaScript Standards
- Use native ES module imports with explicit `.js` extensions.
- Maintain "no build step" philosophy; do not introduce transpilers or bundlers to the active `web-client`.
- Components should be registered in `components/*.js` and used as custom tags in pages or the main app.

## Database Schema
- **users**: Authentication and identity.
- **books**: Global book metadata (ISBN, Title, Author, Cover URL).
- **user_books**: Join table linking users to books with `status` (`owned`, `wishlisted`, `removed`).
