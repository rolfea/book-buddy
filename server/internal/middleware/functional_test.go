package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/rolfea/book-buddy/server/internal/auth"
	"github.com/rolfea/book-buddy/server/internal/data/query"
)

type mockAuthProvider struct {
	claims *auth.Claims
	err    error
}

func (m *mockAuthProvider) Sign(userID, email string) (string, error) {
	return "mock-token", nil
}

func (m *mockAuthProvider) Validate(token string) (*auth.Claims, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.claims, nil
}

type mockUserStore struct {
	users map[string]query.User
}

func (m *mockUserStore) GetUserByExternalID(ctx context.Context, externalID string) (query.User, error) {
	u, ok := m.users[externalID]
	if !ok {
		return query.User{}, sql.ErrNoRows
	}
	return u, nil
}

func (m *mockUserStore) CreateUser(ctx context.Context, arg query.CreateUserParams) (query.User, error) {
	u := query.User{
		ID:               uuid.New(),
		Email:            arg.Email,
		ExternalID:       arg.ExternalID,
		ExternalProvider: arg.ExternalProvider,
	}
	if m.users == nil {
		m.users = make(map[string]query.User)
	}
	m.users[arg.ExternalID] = u
	return u, nil
}

func TestRequireAuth_Cookie(t *testing.T) {
	provider := &mockAuthProvider{
		claims: &auth.Claims{UserID: "auth0|test-user", Email: "test@example.com"},
	}
	
	// Create a user in the mock store so they exist already
	userUUID := uuid.New()
	store := &mockUserStore{
		users: map[string]query.User{
			"auth0|test-user": {
				ID:               userUUID,
				Email:            "test@example.com",
				ExternalID:       "auth0|test-user",
				ExternalProvider: "auth0",
			},
		},
	}

	mw := RequireAuth(provider, store)

	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			t.Error("claims not found in context")
		}
		if claims.UserID != userUUID.String() {
			t.Errorf("expected user ID %s (database UUID), got %s", userUUID.String(), claims.UserID)
		}
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("Valid Cookie", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		req.AddCookie(&http.Cookie{Name: "token", Value: "valid-token"})
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status OK, got %d", rr.Code)
		}
	})

	t.Run("Missing Authorization", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status Unauthorized, got %d", rr.Code)
		}
	})

	t.Run("Reject Unprovisioned User", func(t *testing.T) {
		// Test user store that doesn't have the user yet
		emptyStore := &mockUserStore{
			users: make(map[string]query.User),
		}
		mwAuto := RequireAuth(provider, emptyStore)
		handlerAuto := mwAuto(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/", nil)
		req.AddCookie(&http.Cookie{Name: "token", Value: "valid-token"})
		rr := httptest.NewRecorder()
		handlerAuto.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status Unauthorized (401), got %d", rr.Code)
		}

		// Ensure no user was added to the mock store
		if len(emptyStore.users) != 0 {
			t.Errorf("expected no user to be provisioned in store, users count is %d", len(emptyStore.users))
		}
	})
}

func TestCSRF(t *testing.T) {
	handler := CSRF(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("GET - No Header", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("GET should not require CSRF header, got %d", rr.Code)
		}
	})

	t.Run("POST - Missing Header", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/", nil)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusForbidden {
			t.Errorf("POST without CSRF header should be forbidden, got %d", rr.Code)
		}
	})

	t.Run("POST - Valid Header", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/", nil)
		req.Header.Set("X-BookBuddy-Request", "true")
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("POST with valid CSRF header should be OK, got %d", rr.Code)
		}
	})
}
