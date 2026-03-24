# AGENTS.md - Backend Intelligence (server/)

This file provides technical guidance for AI agents working specifically on the Go backend service.

## Tech Stack
- **Language**: Go 1.22
- **Framework**: Standard `net/http` (No external router)
- **Database**: PostgreSQL (via `sqlc` for type-safe queries)
- **Auth**: JWT (HMAC-SHA256)

## Critical Commands
```bash
# Start PostgreSQL (from server root)
docker compose up -d

# Run migrations
migrate -path migrations -database "postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable" up

# Run server
go run ./cmd/server/main.go

# Regenerate sqlc code (after editing SQL queries or migrations)
sqlc generate

# Run tests
go test ./...
go test ./internal/auth/... -run TestName # Run single test
```

## Architecture Layers
1. **Controller** (`internal/controller/`): HTTP handlers. Handles JSON marshalling/unmarshalling and validation.
2. **Service** (`internal/service/`): Business logic. Enforces domain rules (e.g., removal reasons). Interface-driven for mocking.
3. **Data** (`internal/data/`): Database access. `Store` wraps generated sqlc queries and provides `ExecTx` for transactions.

## Request Flow
`HTTP → Middleware (CORS → Logging → Auth) → Controller → Service → Store → PostgreSQL`

## Authentication
JWTs are handled in `internal/auth/`. The `RequireAuth` middleware extracts the Bearer token and injects claims into the `context`. Handlers retrieve `userID` from the request context.

## Error Handling
Service layers return sentinel errors (`ErrNotFound`, etc.). Controllers map these to HTTP status codes using helpers in `internal/controller/response.go`.

## Code Generation
Always use `sqlc generate` after modifying `sql/queries/*.sql` or `migrations/`. **DO NOT** manually edit `internal/data/query/*.go`.
