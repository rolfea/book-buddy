# Walkthrough: Auth0 Universal Login Migration

We have successfully migrated Book Buddy's authentication from a custom stateless HMAC-SHA256 JWT cookie system to **Auth0 Universal Login** utilizing the OAuth2 / OIDC Authorization Code Flow with PKCE and the BFF pattern.

---

## 1. Summary of Changes

### Phase 1: Database Migration
* Created migration [000002_migrate_to_idp.up.sql](file:///home/eunoia/Code/book-buddy/server/migrations/000002_migrate_to_idp.up.sql) and [000002_migrate_to_idp.down.sql](file:///home/eunoia/Code/book-buddy/server/migrations/000002_migrate_to_idp.down.sql) to execute a destructive migration:
  * Dropped the local `password_hash` column from the `users` table.
  * Added `external_id` (Auth0 `sub` claim identifier) and `external_provider` as `NOT NULL` columns.
  * Added index `idx_users_external_id` for quick session lookups.
* Updated [user_books.sql](file:///home/eunoia/Code/book-buddy/server/sql/queries/user_books.sql) user queries and regenerated Go models using `sqlc`.
* Updated [seed.go](file:///home/eunoia/Code/book-buddy/server/internal/data/seed.go) to seed default local test users with Auth0 mapping.

### Phase 2: Go Backend Asymmetric Verification & BFF Callback
* Installed `github.com/MicahParks/keyfunc/v3` for secure JWKS caching and token validation.
* Updated [config.go](file:///home/eunoia/Code/book-buddy/server/internal/config/config.go) to load Auth0 configurations.
* Overhauled [jwt.go](file:///home/eunoia/Code/book-buddy/server/internal/auth/jwt.go) to implement `IDPAuthProvider`, supporting asymmetric RS256/JWKS validation and a secure local fallback for dev/testing.
* Decoupled [auth.go](file:///home/eunoia/Code/book-buddy/server/internal/middleware/auth.go) middleware from the database package using a new `UserStore` interface, handling user lookups and auto-provisioning dynamically.
* Added a `POST /api/auth/callback` endpoint in [auth.go](file:///home/eunoia/Code/book-buddy/server/internal/controller/auth.go) to handle backend-for-frontend token exchanges.

### Phase 3: Frontend Integration & Redirections
* Added Auth0 environment variables to config generation script [generate-config.mjs](file:///home/eunoia/Code/book-buddy/web-client/generate-config.mjs).
* Overhauled [auth.js](file:///home/eunoia/Code/book-buddy/web-client/auth.js) on the frontend to manage cryptographically secure PKCE states and direct authorization redirects.
* Replaced credentials forms with simple Auth0 action buttons in the custom element [auth-form.js](file:///home/eunoia/Code/book-buddy/web-client/components/auth-form.js).
* Created landing pages [callback.html](file:///home/eunoia/Code/book-buddy/web-client/callback.html) and [callback.js](file:///home/eunoia/Code/book-buddy/web-client/callback.js) to resolve code exchanges via Go BFF endpoint and forward users to the library interface.

---

## 2. Verification and Testing

### Go Backend Verification
* Added `TestIDPAuthProvider_JWKS` integration test in [jwt_test.go](file:///home/eunoia/Code/book-buddy/server/internal/auth/jwt_test.go) by spinning up a mock HTTP server serving public key structures.
* Updated functional middleware tests in [functional_test.go](file:///home/eunoia/Code/book-buddy/server/internal/middleware/functional_test.go) to simulate Auth0 token payloads and verify auto-provisioning.
* **Result**: `go test ./...` passes successfully.

### Frontend DOM Verification
* Updated unit tests in [auth-form.test.js](file:///home/eunoia/Code/book-buddy/web-client/test/auth-form.test.js) and [auth.test.js](file:///home/eunoia/Code/book-buddy/web-client/test/auth.test.js) to assert redirection and callback mechanics.
* Cleaned up linter configurations in [eslint.config.js](file:///home/eunoia/Code/book-buddy/web-client/eslint.config.js) to validate standard window environment globals.
* **Result**: All `46` tests pass and `npm run lint` checks out perfectly.

---

## 3. Auth0 Application Registration & Setup Guide

To connect the application to Auth0, follow these steps to register your client and configure the environment:

### Step 1: Create an Auth0 Application
1. Log in to your [Auth0 Dashboard](https://manage.auth0.com/).
2. Navigate to **Applications** > **Applications** and click **Create Application**.
3. Name it `Book Buddy` and select **Regular Web Application** (since we use the BFF pattern where the client secret is securely stored and handled on the Go backend).
4. Click **Create**.

### Step 2: Configure Application Settings
Scroll down to the Settings page and configure:
1. **Allowed Callback URLs**: `http://localhost:8081/callback.html` (this is the client landing page that handles the redirect and forwards authorization codes).
2. **Allowed Logout URLs**: `http://localhost:8081`
3. Click **Save Changes** at the bottom of the page.

### Step 3: Configure Local Environment Variables
1. Copy the **Domain**, **Client ID**, and **Client Secret** from your Auth0 Application Settings page.
2. Open [server/.env](file:///home/eunoia/Code/book-buddy/server/.env) and populate the values:
   ```env
   AUTH0_DOMAIN=your-tenant.us.auth0.com
   AUTH0_CLIENT_ID=your-client-id
   AUTH0_CLIENT_SECRET=your-client-secret
   ```

### Step 4: Generate Frontend Client Config
Run the helper script to export these public keys to the frontend configuration file:
```bash
export AUTH0_DOMAIN=your-tenant.us.auth0.com
export AUTH0_CLIENT_ID=your-client-id
node web-client/generate-config.mjs
```
This writes the public configuration values to the ignored `web-client/config.js` file so they are loaded into the browser at runtime.

