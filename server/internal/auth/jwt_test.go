package auth_test

import (
	"testing"

	"github.com/rolfea/book-buddy/server/internal/auth"
)

func TestJWTRoundTrip(t *testing.T) {
	provider := auth.NewJWTAuthProvider("test-secret-that-is-long-enough-32chars", 72)

	token, err := provider.Sign("user-123", "user@example.com")
	if err != nil {
		t.Fatalf("Sign error: %v", err)
	}

	claims, err := provider.Validate(token)
	if err != nil {
		t.Fatalf("Validate error: %v", err)
	}

	if claims.UserID != "user-123" {
		t.Errorf("expected UserID 'user-123', got %q", claims.UserID)
	}
	if claims.Email != "user@example.com" {
		t.Errorf("expected Email 'user@example.com', got %q", claims.Email)
	}
}

func TestJWTInvalidToken(t *testing.T) {
	provider := auth.NewJWTAuthProvider("test-secret-that-is-long-enough-32chars", 72)

	_, err := provider.Validate("not.a.valid.token")
	if err == nil {
		t.Error("expected error for invalid token, got nil")
	}
}
