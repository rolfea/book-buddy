# Book Collection App — Backend Planning Doc

## Project Overview

A Go-based REST API backend for a book collection and wishlist management app.
Users can track books they own, maintain wishlists, and see what's on friends' wishlists.

## System Architecture

### Three-Layer Architecture

- **Controller Layer** — HTTP route handlers, request/response marshalling
- **Service Layer** — Business logic, orchestration between data sources
- **Data Layer** — Database queries, caching, external API fallback (Open Library)

### Database

- PostgreSQL

### External Integrations

- Open Library API (book metadata, queried on-demand with caching; ETL deferred until latency/rate limits justify it)
- Barcode/ISBN scanning via frontend camera API

## Core Data Model (MVP)

- `users` — no roles or user types for now
- `books` — populated from Open Library database import (manual sync)
- `user_books` — join table: id (PK), user_id, book_id, status enum (`owned` | `wishlisted` | `removed`)
- `removal_reasons` — FK to `user_books.id`, reason field

### Deferred from Data Model

- **Shared collections** — target architecture: `collections` table, `collection_users` (one-to-many users per collection), `collection_books` replaces `user_books`. Enables shared ownership (e.g., household libraries). Migration path: convert `user_books` → `collection_books`, create default collection per user, add membership tables.
- `user_relationships` (friends/shared wishlists) — next stage
- Book location tracking — `user_locations` table (id, user_id, location_name) with FK from `user_books`

## Authentication

- Abstracted auth layer starting with JWT
- Designed to swap in Auth0 or similar without touching core logic

## Technology Choices

### Framework: net/http (standard library)

- Chosen to learn Go internals during the project
- Migration to Gin or similar is straightforward if complexity warrants it later
- Expect to build custom middleware chaining and handler wrapper patterns

### Database Migrations: golang-migrate

- Standard migration tool for Go projects
- SQL-based up/down migration files
- Generates type-safe Go code from raw SQL queries
- Full control over SQL; no ORM abstraction

### Project Structure (standard Go layout)

```
cmd/        # entrypoints
internal/   # private app code
```

## Middleware (custom via net/http)

- Authentication checks
- Logging
- CORS headers
- Error handling
- Request validation

> Implementation: wrap handler functions with middleware patterns (more verbose than Gin but achievable)

## API Routes (MVP)

All routes require authentication.

### `/user/books`

- **GET** — returns authenticated user's books (joined from `user_books` + `books`)
- **POST** — adds one or many books to user's collection (creates `user_books` entries)
- **PATCH** — updates status on one or many `user_books` entries (e.g., wishlisted → owned, owned → removed). When setting status to `removed`, a reason is required — service layer enforces this in a single transaction (update status + insert `removal_reasons` or rollback).
- **DELETE** — removes a `user_books` entry entirely (accidental add)

## Configuration Management

- Environment variables via `os.Getenv`, loaded from `.env` file in development (`godotenv`)
- Managed values: database connection string, JWT secret, server port, Open Library API base URL
- `.env` added to `.gitignore`; `.env.example` committed as a template

## Testing

- Go standard `testing` package
- Unit tests on service layer functions as initial focus
- Expand to integration tests as needed

## Known Architectural Risks

## Known Architectural Risks

- Service layer can become bloated as complexity grows — consider splitting into focused sub-services
- Data source coupling in service layer — stronger abstractions in the data layer would help
- net/http middleware chaining can get messy — establish wrapper conventions early

## Deferred Features

- **ETL pipeline** — query Open Library on-demand for MVP; build ETL when traffic justifies it
- **Image-based book lookup** — photo of title page for books without barcodes; post-MVP
- **Named sub-collections** — ("Currently Reading," "Favorites," etc.); post-MVP

## Open Questions

- [ ] Auth0 migration trigger — what's the threshold?
- [ ] Open Library import — mechanism for loading and filtering the database dump?

## Running Locally

### Prerequisites

- Go 1.22+
- Docker
- [`migrate` CLI](https://github.com/golang-migrate/migrate/tree/master/cmd/migrate)

### Start Postgres

```bash
docker compose up -d
```

### Configure environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET to a random string of at least 32 chars
```

### Run migrations

```bash
migrate -path migrations -database "postgres://bookbuddy:bookbuddy@localhost:5432/bookbuddy?sslmode=disable" up
```

### Start the server

```bash
go run ./cmd/server/main.go
```

### Run tests

```bash
go test ./...
```

## Suggested Next Steps

1. Finalize PostgreSQL schema
2. Set up Go project structure (`cmd/`, `internal/`)
3. Build a single vertical slice (e.g., books resource) top to bottom: route → auth → service → data layer
4. Expand horizontally to remaining resources
5. Wire up data layer with sqlc
6. Connect and test against PostgreSQL
