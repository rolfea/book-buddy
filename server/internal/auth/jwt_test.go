package auth_test

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
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

func TestIDPAuthProvider_JWKS(t *testing.T) {
	// 1. Generate RSA key pair
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	pubKey := &privateKey.PublicKey

	// 2. Construct JWK parameters
	nBase64 := base64.RawURLEncoding.EncodeToString(pubKey.N.Bytes())
	eBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(eBytes, uint32(pubKey.E))
	start := 0
	for start < len(eBytes) && eBytes[start] == 0 {
		start++
	}
	eBase64 := base64.RawURLEncoding.EncodeToString(eBytes[start:])

	jwk := map[string]interface{}{
		"kty": "RSA",
		"use": "sig",
		"alg": "RS256",
		"kid": "test-kid",
		"n":   nBase64,
		"e":   eBase64,
	}
	jwks := map[string]interface{}{
		"keys": []interface{}{jwk},
	}

	jwksBytes, err := json.Marshal(jwks)
	if err != nil {
		t.Fatalf("failed to marshal JWKS: %v", err)
	}

	// 3. Spin up mock JWKS HTTP server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(jwksBytes)
	}))
	defer server.Close()

	// 4. Initialize IDPAuthProvider pointing to our mock server
	issuer := "https://test-issuer.com/"
	audience := "https://test-audience.com"
	provider, err := auth.NewIDPAuthProvider(server.URL, issuer, audience, "")
	if err != nil {
		t.Fatalf("failed to create IDP provider: %v", err)
	}

	// 5. Sign a token using the private key (RS256)
	claims := auth.Claims{
		UserID: "auth0|test-user-jwks",
		Email:  "jwks@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{audience},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-kid"
	tokenStr, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	// 6. Validate the token using the IDPAuthProvider
	parsedClaims, err := provider.Validate(tokenStr)
	if err != nil {
		t.Fatalf("failed to validate token: %v", err)
	}

	if parsedClaims.UserID != "auth0|test-user-jwks" {
		t.Errorf("expected UserID 'auth0|test-user-jwks', got %q", parsedClaims.UserID)
	}
	if parsedClaims.Email != "jwks@example.com" {
		t.Errorf("expected Email 'jwks@example.com', got %q", parsedClaims.Email)
	}
}
