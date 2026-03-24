package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rolfea/book-buddy/server/internal/auth"
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

func TestRequireAuth_Cookie(t *testing.T) {
	provider := &mockAuthProvider{
		claims: &auth.Claims{UserID: "123", Email: "test@example.com"},
	}
	middleware := RequireAuth(provider)

	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			t.Error("claims not found in context")
		}
		if claims.UserID != "123" {
			t.Errorf("expected user ID 123, got %s", claims.UserID)
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
