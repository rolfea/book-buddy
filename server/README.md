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

- Open Library
  - API (book metadata, queried on-demand with caching
  - Eventually, keep the book DB in postgres. We can defer this for now, and then once implemented, the API can serve as a fallback
- Barcode/ISBN scanning via frontend camera API
- For later, some kind of image processing model for alternatve to ISBN look ups (ie., scan the title page, perform lookup by title)

## Core Data Model (MVP)

- `users` — no roles or user types for now
- `books` — populated from Open Library database import (manual sync)
- `user_books` — join table: id (PK), user_id, book_id, status enum (`owned` | `wishlisted` | `removed`)
- `removal_reasons` — FK to `user_books.id`, reason field

### Deferred from Data Model

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
migrate -path migrations -database "postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable" up
```

### Start the server

```bash
go run ./cmd/server/main.go
```

### Run tests

```bash
go test ./...
```
