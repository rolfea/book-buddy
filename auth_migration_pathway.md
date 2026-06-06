# Book Buddy - Authentication Migration Pathway

This document outlines the architectural roadmap for migrating Book Buddy's authentication system from a basic email/password and stateless JSON Web Token (JWT) cookie system to a more robust, secure, and modern authentication architecture.

---

## 1. Current Authentication Architecture & Limitations

The current authentication mechanism in Book Buddy is implemented across the following modules:
* **Backend Controller**: [controller/auth.go](file:///home/eunoia/Code/book-buddy/server/internal/controller/auth.go) handles registrations via `bcrypt` hashing, logs users in, and signs JWTs using symmetric HMAC-SHA256 (`HS256`).
* **Backend Middleware**: [middleware/auth.go](file:///home/eunoia/Code/book-buddy/server/internal/middleware/auth.go) extracts JWT tokens from either the `Authorization` header or a Lax `HttpOnly` cookie.
* **Frontend Controller**: [auth.js](file:///home/eunoia/Code/book-buddy/web-client/auth.js) manages logins, registrations, and memory session checks (`/auth/me`).

### Key Vulnerabilities and Operational Limitations:
1. **Stateless Session Control (No Revocation)**: JWTs are validated entirely statelessly. If a user's token is leaked, it cannot be revoked before it naturally expires (configured for 3 days in [auth.go](file:///home/eunoia/Code/book-buddy/server/internal/controller/auth.go#L45)).
2. **Standard Bcrypt Usage**: Bcrypt is resilient but vulnerable to GPU-accelerated brute-forcing. OWASP currently recommends **Argon2id** for password hashing.
3. **No Multi-Factor Authentication (MFA)**: There is no secondary validation mechanism (TOTP, SMS, Email OTP).
4. **Lack of Account Safety Features**: No login rate-limiting, no account lockouts, no password complexity requirements, and no password recovery flow.
5. **No Third-Party/Social Identities**: Users must register an explicit email/password credential rather than using convenient Single Sign-On (SSO) providers like Google or GitHub.

---

## 2. Target Security Architecture Options

Four migration options exist, varying by implementation complexity and security guarantees:

### Option A: Passwordless Authentication via Passkeys (WebAuthn)
*Highly Recommended for Security & User Experience*

Eliminates passwords completely, replacing them with biometric checks (Touch ID, Face ID, Windows Hello) or hardware keys (YubiKeys) using the browser's native **WebAuthn API**.

* **Frontend Integration**: Replaces passwords with `navigator.credentials.create()` (for registration) and `navigator.credentials.get()` (for login). Runs entirely without a JS compiler.
* **Backend Integration**: Implement a library like `github.com/go-webauthn/webauthn` in Go. Requires two endpoints:
  1. Generate challenge parameters (e.g. `/api/auth/webauthn/register/begin`).
  2. Verify authenticator signatures (e.g. `/api/auth/webauthn/register/finish`).
* **Database Impact**: Add a `user_credentials` table to store public keys, sign counters, and credential IDs associated with each user.

### Option B: Managed Identity Providers (IdP) / Auth-as-a-Service
*Best for Rapid Delivery and Zero Maintenance*

Offload auth logic entirely to a specialized third-party provider like **Clerk**, **Auth0**, or **Kinde**.

* **Frontend Integration**: Include the provider's pre-built login/signup widget in [login.js](file:///home/eunoia/Code/book-buddy/web-client/pages/login.js) and [register.js](file:///home/eunoia/Code/book-buddy/web-client/pages/register.js).
* **Backend Integration**: Refactor [RequireAuth](file:///home/eunoia/Code/book-buddy/server/internal/middleware/auth.go) to validate JWTs asymmetrically (using RS256/ES256) via a public JSON Web Key Set (JWKS) fetched from the provider's endpoint, cached locally in memory.
* **Database Impact**: Remove `password_hash` from the `users` table. Add a unique `external_id` column to map user book metadata records to the provider's user ID.

### Option C: OAuth2 / Social Logins (Google & GitHub)
*Best for Higher User Conversion*

Offer standard OAuth2 authentication flow side-by-side with an upgraded local authentication system.

* **Frontend Integration**: Render "Sign in with Google" and "Sign in with GitHub" buttons. Handled via standard redirect paths or OAuth redirect flows.
* **Backend Integration**: 
  - Add `/api/auth/oauth/{provider}/login` to redirect users to the provider's authorization endpoint.
  - Add `/api/auth/oauth/{provider}/callback` to exchange authorization codes for access tokens, fetch user profiles, link records, and issue standard local JWT tokens.
* **Security Note**: Implement PKCE (Proof Key for Code Exchange) even on backend-driven flows for enhanced mitigation of auth code interception attacks.

### Option D: Hardening the Existing Custom Authentication Stack
*Best for Zero External Dependencies & Open Source Purists*

Upgrade the existing Go implementation to align with modern OWASP top-10 standards.

1. **Migrate Password Hashing to Argon2id**:
   Replace `golang.org/x/crypto/bcrypt` with `golang.org/x/crypto/argon2`.
2. **Add a Session Table for Revocation**:
   Instead of stateless JWT validation, store session IDs in PostgreSQL (with IP, User Agent, and expiration). Read this table on each request. Logout deletes the database record, immediately invalidating the session.
3. **Implement Time-Based One-Time Passwords (TOTP)**:
   Add a columns `totp_secret` and `mfa_enabled` to `users`. Serve a barcode to the client when enabling MFA, and prompt for a TOTP code during login using a package like `github.com/pquerna/otp`.
4. **Brute Force Defense**:
   Implement middleware to rate-limit requests to login and registration paths (e.g. limiting to 5 login attempts per IP/username per 15 minutes) using an in-memory token bucket.

---

## 3. Comparison Matrix

| Criteria | Option A: Passkeys | Option B: Managed IdP | Option C: OAuth2 | Option D: Hardened Auth |
| :--- | :--- | :--- | :--- | :--- |
| **Phishing Resistance** | 🔴 Maximum (Cryptographic) | 🟡 Moderate (Conditional) | 🟢 High (Federated) | 🔴 Low (Standard Password) |
| **Development Cost** | 🟡 Medium | 🟢 Low | 🟡 Medium | 🔴 High |
| **User Sign-in Friction** | 🟢 Extremely Low | 🟢 Low | 🟢 Low | 🟡 Medium |
| **Third-Party Dependency**| None | High | Medium (Google/GitHub) | None |
| **Infrastructure Cost** | Free | Tiered (Free -> Paid) | Free | Free |

---

## 4. Phase-by-Phase Migration Plan (Assuming Option D or Social OAuth2)

### Phase 1: Database Schema Migration
Before modifying code, update your database schema using `golang-migrate` files in [server/migrations](file:///home/eunoia/Code/book-buddy/server/migrations):
```sql
-- migration file: add_auth_hardening.up.sql
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN external_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN external_provider_id VARCHAR(255);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_agent VARCHAR(255),
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
```

### Phase 2: Refactoring Backend Services
1. **Define Session Storage**: 
   Write a `SessionStore` inside [data/store.go](file:///home/eunoia/Code/book-buddy/server/internal/data/store.go) using `sqlc` to insert, select, and delete sessions.
2. **Implement Argon2id Utility**:
   Create a utility inside `server/internal/auth/argon2.go` using parameter configurations recommended by RFC 9106:
   * Memory: 64MB (65536 KB)
   * Iterations (Passes): 3
   * Parallelism: 4
3. **Upgrade Auth Middleware**:
   Change [RequireAuth](file:///home/eunoia/Code/book-buddy/server/internal/middleware/auth.go) to verify session hashes against the database instead of stateless JWT signature checks.

### Phase 3: Upgrading Frontend Modules
1. **Handle MFA Challenges**:
   Modify [auth-form.js](file:///home/eunoia/Code/book-buddy/web-client/components/auth-form.js) to show a secondary input field if the API returns a status showing that MFA verification is required:
   ```javascript
   // Pseudo-code for login submission
   const res = await login(email, password);
   if (res.mfaRequired) {
       showMFAPrompt(res.tempToken);
   }
   ```
2. **Maintain Vanilla-Friendly Client**:
   Avoid injecting massive vendor frameworks into the client. Choose identity tools that compile down to standard script inputs or write clean, standard Web Component wrappers for OAuth redirect buttons.

### Phase 4: Gradual Password Migration
To ensure existing users aren't locked out when migrating from Bcrypt to Argon2id:
1. When a user submits a login, first fetch their password hash from the database.
2. If the hash starts with `$2a$` or `$2b$` (Bcrypt prefixes), verify it using `bcrypt.CompareHashAndPassword`.
3. Upon successful verification:
   - Immediately hash the plaintext password using **Argon2id**.
   - Save the new Argon2id hash back to the database.
   - Proceed with generating the user's session.
4. If the hash matches Argon2id format, verify it directly using the Argon2id validator.

---

## 5. Updates to Testing Strategy

Upgrading authentication requires updating our testing strategy. Standard unit tests (like [test/auth.test.js](file:///home/eunoia/Code/book-buddy/web-client/test/auth.test.js)) must be supplemented with Playwright E2E integration tests to handle more complex authentication mechanics:

### 1. Testing Passkeys (WebAuthn)
Because passkeys interact directly with browser hardware interfaces, they cannot be tested using traditional unit tests. Playwright solves this using the Chrome DevTools Protocol (CDP) to register a Virtual Authenticator:

```javascript
// Example Playwright test helper for WebAuthn/Passkeys
test('Registering and Authenticating with a Passkey', async ({ page }) => {
  const cdpSession = await page.context().newCDPSession(page);
  
  // 1. Enable Virtual Authenticator
  await cdpSession.send('WebAuthn.enable');
  
  // 2. Add a virtual FIDO2 credentials key (supports resident keys and user verification)
  await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    }
  });

  await page.goto('/#/register');
  // Click register and trigger WebAuthn navigator.credentials.create()
  await page.click('#register-passkey-btn');
  
  // Verify user is redirected to the books library
  await expect(page).toHaveURL(/.*#\/books/);
});
```

### 2. Testing Multi-Factor Authentication (TOTP)
To test MFA registration and validation:
- **Unit/Integration Tests**: Write backend Go tests that generate a mock secret, run it through your TOTP generation helper, and verify that incorrect or slightly skewed/expired codes fail.
- **E2E Tests**: Store the user's seed key in test configurations. During the Playwright test flow:
  1. Catch the MFA challenge page.
  2. Generate a 6-digit TOTP code dynamically in the test script using `otplib` (or a similar client-side library) with the seed.
  3. Input the code programmatically and verify access:
     ```javascript
     import { authenticator } from 'otplib';
     const totpToken = authenticator.generate(TEST_USER_TOTP_SECRET);
     await page.fill('#mfa-code-input', totpToken);
     await page.click('#verify-btn');
     ```

### 3. Bypassing Third-Party IDPs in Local/Test Environments
E2E testing against third-party authentication services (like Clerk or Auth0) in CI is problematic due to rate limiting, CAPTCHAs, and network dependencies.
* **Backend Bypass Flag**: Run the backend in `ENVIRONMENT=test` mode. In this mode, the [RequireAuth](file:///home/eunoia/Code/book-buddy/server/internal/middleware/auth.go) middleware accepts a mock self-signed JWT token, allowing local test requests to bypass remote JWKS verification.
* **Context Injection**: Use Playwright's `browserContext.addCookies()` to set a mock `token` session cookie directly into the browser state before running tests, enabling instant login bypass.

### 4. Testing Session Database Revocation
To verify that logout is immediate and absolute:
- Create a test session in the database.
- Send an API request using that session's token to verify it succeeds (returns HTTP 200).
- Call `/api/auth/logout`.
- Send the same API request again and assert that it returns HTTP 401 Unauthorized.
- Query the database to confirm that the corresponding record in `user_sessions` has been deleted.

