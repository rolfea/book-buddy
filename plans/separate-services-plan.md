# Plan: Separate Services and Deploy to Render

## Objective
Separate the `web-client` and `server` into two distinct services on Render while upgrading security to use **HttpOnly Cookies** instead of `localStorage`.
- **Backend:** Native Go service (API only).
- **Frontend:** Static site service with dynamic configuration.

## 1. Backend Modifications (Go)
- **Remove Static File Serving:** Update `server/cmd/server/main.go` to remove all code that serves the `web-client` directory.
- **Improved CORS & Credentials:** 
  - Update `server/internal/middleware/cors.go` to support subdomain matching.
  - Set `Access-Control-Allow-Credentials: true`.
  - **Strict Origin Check:** Disallow `*` when credentials are enabled; only allow origins from `CORS_ALLOWED_ORIGINS`.
- **HttpOnly Cookie Auth:**
  - Update `internal/controller/auth.go` to set a cookie named `token` with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
  - Update `internal/auth/` to read claims from the cookie instead of the `Authorization` header.
- **CSRF Protection (Simple):** 
  - Add middleware to verify the presence of a custom header (e.g., `X-BookBuddy-Request`) on all non-GET requests. This ensures the request originated from the app UI.
- **Health Check:** Add a `GET /health` endpoint.
- **Static Binary Enforcement:** Build with `CGO_ENABLED=0`.

## 2. Frontend Modifications (Vanilla JS)
- **Dynamic Configuration:**
  - Create `web-client/config.js` (gitignored) for `window.API_BASE_URL`.
  - Update `web-client/index.html` to load `config.js`.
- **HttpOnly Cookie Migration:**
  - Update `web-client/auth.js` to remove `localStorage` logic (the browser now handles the token automatically).
  - Update `web-client/api.js` to:
    - Include `credentials: 'include'` in all `fetch` options.
    - Automatically inject the CSRF header (`X-BookBuddy-Request: true`) on every request.
- **Reachability Check & Error UI:**
  - Update `app.js` to perform a health check on the API at startup.
  - Display a "Service Unreachable" error page if the API or its health check fails.

## 3. Deployment Configuration (Render)
- **Unified Domain Strategy:**
  - Assign `example.com` to the Frontend and `api.example.com` to the Backend.
  - Configure the backend's `CORS_ALLOWED_ORIGINS` to the frontend's production URL.
- **Blueprint (`render.yaml`):**
  - **Database:** Managed PostgreSQL.
  - **API Service:** Native Go web service.
    - Build: `cd server && CGO_ENABLED=0 go build -o app ./cmd/server/main.go`
    - Start: `cd server && ./app`
  - **Frontend Service:** Static site service.
    - Build: `cd web-client && node generate-config.js`
    - Publish Directory: `./web-client`

## 4. Local Development Workflow
- **Makefile Update:** Use `npx http-server` for the frontend on port 8081.
- **Verification:**
  1. Start both services.
  2. Log in and verify (via Browser DevTools) that the `token` cookie is present and marked `HttpOnly`.
  3. Verify that the `Authorization` header is NO LONGER sent in the request.
  4. Verify the `X-BookBuddy-Request` header IS sent.
  5. Verify the frontend shows an error if the backend is offline.
