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

func TestIDPAuthProvider_Fallback(t *testing.T) {
	fallbackSecret := "test-secret-that-is-long-enough-32chars"
	provider, err := auth.NewIDPAuthProvider("", "", "", fallbackSecret)
	if err != nil {
		t.Fatalf("failed to create IDP provider: %v", err)
	}

	// Sign a token using fallback
	token, err := provider.Sign("user-456", "fallback@example.com")
	if err != nil {
		t.Fatalf("Sign error: %v", err)
	}

	// Validate token using fallback
	claims, err := provider.Validate(token)
	if err != nil {
		t.Fatalf("Validate error: %v", err)
	}

	if claims.UserID != "user-456" {
		t.Errorf("expected UserID 'user-456', got %q", claims.UserID)
	}
	if claims.Email != "fallback@example.com" {
		t.Errorf("expected Email 'fallback@example.com', got %q", claims.Email)
	}
}
