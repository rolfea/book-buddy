# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

```
book-buddy/
├── server/          # Go REST API (see server/CLAUDE.md for full detail)
├── alt-client/      # Vanilla JS + Web Components client (no build step, served by Go server)
└── web-client/      # React + TypeScript frontend (React Router v7, Vite)
```

## Backend (server/)

See `server/CLAUDE.md` for full commands, architecture, and code-generation notes.

Quick reference:
```bash
cd server
docker compose up -d                                      # start PostgreSQL
go run ./cmd/server/main.go                               # run API server (default :8080)
go test ./...                                             # run all tests
go test ./internal/auth/... -run TestName                 # run a single test
sqlc generate                                             # regenerate DB code after SQL changes
```

Copy `server/.env.example` → `server/.env` and set `JWT_SECRET` to a random 32+ character string.

## Alt client (alt-client/)

See `alt-client/CLAUDE.md` for full detail. No build step — files are served as static assets directly by the Go server.

```bash
# The Go server serves alt-client at http://localhost:8080
cd server && go run ./cmd/server/main.go

# Tests (Node built-in test runner + happy-dom)
cd alt-client
npm install
npm test
```

## Frontend (web-client/)

```bash
cd web-client
npm run dev          # dev server with HMR on :5173
npm run build        # production build
npm run typecheck    # TypeScript type checking (react-router typegen + tsc)
```

## Architecture overview

The backend is a Go REST API using standard `net/http` with a custom middleware chain (no external router). There are two clients:

- **alt-client** — Vanilla JS + Web Components, no build step. The Go server serves it as static files at `http://localhost:8080`. This is the primary client integrated with the server.
- **web-client** — React Router v7 (Vite), runs separately on `:5173`. Calls the Go API over HTTP.

Both clients use the Barcode Detection API to scan ISBNs from the device camera.

Request flow: `Client → Go API → PostgreSQL`

Auth: JWTs issued by the Go server, stored client-side in `localStorage`, sent as Bearer tokens.
