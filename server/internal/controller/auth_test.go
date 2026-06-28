package controller_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"github.com/rolfea/book-buddy/server/internal/auth"
	"github.com/rolfea/book-buddy/server/internal/controller"
	"github.com/rolfea/book-buddy/server/internal/data"
)

func TestCallback_SuccessAndProvisioning(t *testing.T) {
	// 1. Connect to test database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable"
	}
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		t.Fatalf("database unreachable: %v", err)
	}

	// Clean users table before testing
	_, err = db.Exec("TRUNCATE TABLE users CASCADE")
	if err != nil {
		t.Fatalf("failed to truncate users table: %v", err)
	}

	store := data.NewStore(db)

	// 2. Generate a valid mock ID Token
	idTokenClaims := auth.Claims{
		UserID: "auth0|test-callback-user",
		Email:  "callback-user@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "https://test-issuer.auth0.com/",
			Audience:  jwt.ClaimStrings{"test-client-id"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	idToken := jwt.NewWithClaims(jwt.SigningMethodHS256, idTokenClaims)
	idTokenStr, err := idToken.SignedString([]byte("mock-secret-not-used-signature-unverified"))
	if err != nil {
		t.Fatalf("failed to sign mock ID token: %v", err)
	}

	mockAccessToken := "mock-access-token-12345"

	// 3. Setup mock Auth0 token exchange server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth/token" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var reqBody map[string]string
		err := json.NewDecoder(r.Body).Decode(&reqBody)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Verify parameters expected from the client
		if reqBody["grant_type"] != "authorization_code" ||
			reqBody["code"] != "test-code" ||
			reqBody["code_verifier"] != "test-verifier" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fmt.Sprintf(`{
			"id_token": %q,
			"access_token": %q
		}`, idTokenStr, mockAccessToken)))
	}))
	defer server.Close()

	// 4. Initialize AuthController
	// Extract the host:port from test server URL
	auth0Domain := strings.TrimPrefix(server.URL, "http://")

	authProvider, err := auth.NewIDPAuthProvider("", "", "", "fallback-secret")
	if err != nil {
		t.Fatalf("failed to initialize auth provider: %v", err)
	}

	ctrl := controller.NewAuthController(
		store,
		authProvider,
		false, // secureCookies = false
		auth0Domain,
		"test-client-id",
		"test-client-secret",
		"http://localhost:8080/callback.html",
	)

	// 5. Invoke Callback endpoint
	reqPayload := map[string]string{
		"code":          "test-code",
		"code_verifier": "test-verifier",
	}
	bodyBytes, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest("POST", "/api/auth/callback", bytes.NewBuffer(bodyBytes))
	rr := httptest.NewRecorder()

	ctrl.Callback(rr, req)

	// 6. Assertions
	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	// Verify cookie was set with the ID Token
	cookies := rr.Result().Cookies()
	var tokenCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "token" {
			tokenCookie = c
			break
		}
	}

	if tokenCookie == nil {
		t.Fatal("expected 'token' cookie to be set, but it was not found")
	}

	if tokenCookie.Value != idTokenStr {
		t.Errorf("expected cookie value to be ID token %q, got %q", idTokenStr, tokenCookie.Value)
	}

	// Verify user was provisioned in the database
	ctx := context.Background()
	user, err := store.GetUserByExternalID(ctx, "auth0|test-callback-user")
	if err != nil {
		t.Fatalf("user was not provisioned in the database: %v", err)
	}

	if user.Email != "callback-user@example.com" {
		t.Errorf("expected user email %q, got %q", "callback-user@example.com", user.Email)
	}
}
