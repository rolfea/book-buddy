# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Start dependencies:**
```bash
docker compose up -d
```

**Run database migrations:**
```bash
migrate -path migrations -database "postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable" up
```

**Run server:**
```bash
go run ./cmd/server/main.go
```

**Run all tests:**
```bash
go test ./...
```

**Run a single test:**
```bash
go test ./internal/auth/... -run TestName
```

**Regenerate sqlc code** (after editing `sql/queries/*.sql` or `migrations/`):
```bash
sqlc generate
```

**Environment setup:** Copy `.env.example` to `.env` and set `JWT_SECRET` to a random 32+ character string.

## Architecture

This is a Go REST API for a personal book collection manager. The server uses standard `net/http` with a custom middleware chain — no external router framework.

### Layers

**Controller** (`internal/controller/`) — HTTP handlers. Parses requests, validates input, delegates to service, writes JSON responses.

**Service** (`internal/service/`) — Business logic. Enforces rules (e.g., `removal_reason` required when status is `removed`). Uses `BooksServicer` interface for testability.

**Data** (`internal/data/`) — Database access. `Store` wraps sqlc-generated queries (`internal/data/query/`) and adds `ExecTx` for transactions. `openlibrary.go` is a stub for future book metadata fetching.

### Request flow

```
HTTP → Middleware (CORS → Logging → Auth) → Controller → Service → Store → PostgreSQL
```

### Auth

JWT (HMAC-SHA256) via `internal/auth/`. The `RequireAuth` middleware extracts the Bearer token, validates it, and injects claims into `context`. Controllers read `userID` from context.

### Database

PostgreSQL with three core tables: `users`, `books` (keyed by ISBN), and `user_books` (join table with `status` enum: `owned | wishlisted | removed`). Schema lives in `migrations/`, queries in `sql/queries/`, generated Go code in `internal/data/query/`.

### Code generation

sqlc generates type-safe DB code from SQL. After editing queries or schema, run `sqlc generate` — do not hand-edit files in `internal/data/query/`.

### Error handling pattern

Service functions return sentinel errors (`ErrNotFound`, `ErrBadRequest`). Controllers map these to HTTP status codes and return `{"error": "..."}` JSON via helpers in `internal/controller/response.go`.
