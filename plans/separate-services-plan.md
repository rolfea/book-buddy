# Plan: Separate Services and Deploy to Render

## Objective
Separate the `web-client` and `server` into two distinct services to be deployed on Render.
- **Backend:** Native Go service (API only).
- **Frontend:** Static site service with dynamic configuration.

## 1. Backend Modifications (Go)
- **Remove Static File Serving:** Update `server/cmd/server/main.go` to remove all code that serves the `web-client` directory. The server will now act strictly as a JSON API.
- **Dynamic CORS:** Update `server/internal/middleware/cors.go` to respect a `CORS_ALLOWED_ORIGINS` environment variable. This allows the separately hosted frontend to communicate with the API.

## 2. Frontend Modifications (Vanilla JS)
- **Dynamic Configuration:**
  - Create `web-client/config.js` (gitignored) to store the API base URL.
  - Update `web-client/index.html` to load `config.js` before the main application script.
  - Update `web-client/api.js` to use `window.API_BASE_URL` with a fallback to `http://localhost:8080`.
- **Config Generation Script:**
  - Create `web-client/generate-config.js` (Node.js script) to generate `config.js` from the `API_URL` environment variable during the build process.
- **Local Development Server:**
  - Add `http-server` as a dev dependency in `web-client/package.json`.
  - Add a `"dev"` script to serve the frontend locally on port 8081, ensuring ES modules and CORS work correctly.

## 3. Deployment Configuration (Render)
- **Blueprint (`render.yaml`):**
  - **Database:** Managed PostgreSQL instance.
  - **API Service:** Native Go web service.
    - Build Command: `cd server && go build -o app ./cmd/server/main.go`
    - Start Command: `cd server && ./app`
    - Environment Variables: `DATABASE_URL`, `JWT_SECRET`, and `CORS_ALLOWED_ORIGINS` (mapped to the frontend URL).
  - **Frontend Service:** Static site service.
    - Build Command: `cd web-client && node generate-config.js`
    - Publish Directory: `./web-client`
    - Environment Variables: `API_URL` (mapped to the backend URL).

## Verification Steps
1. **Local Backend:** Run `go run ./cmd/server/main.go` and verify it no longer serves the UI on port 8080.
2. **Local Frontend:** Run `cd web-client && npm run dev` and verify it loads on port 8081.
3. **Integration:** Ensure the local frontend can successfully authenticate and fetch data from the local backend.
