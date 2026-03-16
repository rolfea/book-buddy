# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

```
book-buddy/
├── server/          # Go REST API (see server/CLAUDE.md for full detail)
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

## Frontend (web-client/)

```bash
cd web-client
npm run dev          # dev server with HMR on :5173
npm run build        # production build
npm run typecheck    # TypeScript type checking (react-router typegen + tsc)
```

## Architecture overview

The backend is a Go REST API using standard `net/http` with a custom middleware chain (no external router). The frontend is a React Router v7 app (Vite). They communicate via HTTP — the frontend calls the Go API for auth and book management, and uses the Barcode Detection API to scan ISBNs from the device camera.

Request flow: `React UI → Go API → PostgreSQL`

Auth: JWTs issued by the Go server, stored client-side, sent as Bearer tokens.
