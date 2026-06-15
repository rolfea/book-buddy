package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

type IDPAuthProvider struct {
	jwks     keyfunc.Keyfunc
	issuer   string
	audience string
	fallback *JWTAuthProvider
}

type JWTAuthProvider struct {
	secret      []byte
	expiryHours int
}

func NewJWTAuthProvider(secret string, expiryHours int) *JWTAuthProvider {
	return &JWTAuthProvider{
		secret:      []byte(secret),
		expiryHours: expiryHours,
	}
}

func (p *JWTAuthProvider) Sign(userID, email string) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(p.expiryHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(p.secret)
}

func (p *JWTAuthProvider) Validate(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return p.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func NewIDPAuthProvider(jwksURI, issuer, audience string, fallbackSecret string) (*IDPAuthProvider, error) {
	var jwks keyfunc.Keyfunc
	var err error

	if jwksURI != "" {
		jwks, err = keyfunc.NewDefaultCtx(context.Background(), []string{jwksURI})
		if err != nil {
			return nil, fmt.Errorf("failed to load JWKS: %w", err)
		}
	}

	var fallback *JWTAuthProvider
	if fallbackSecret != "" {
		fallback = NewJWTAuthProvider(fallbackSecret, 72)
	}

	return &IDPAuthProvider{
		jwks:     jwks,
		issuer:   issuer,
		audience: audience,
		fallback: fallback,
	}, nil
}

func (p *IDPAuthProvider) Sign(userID, email string) (string, error) {
	if p.fallback != nil {
		return p.fallback.Sign(userID, email)
	}
	return "", fmt.Errorf("signing not supported in production IDP provider")
}

func (p *IDPAuthProvider) Validate(tokenStr string) (*Claims, error) {
	if p.jwks == nil {
		if p.fallback != nil {
			return p.fallback.Validate(tokenStr)
		}
		return nil, fmt.Errorf("no validator configured")
	}

	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, p.jwks.Keyfunc)
	if err != nil {
		// Fallback to symmetric validation if symmetric signature detected and fallback is enabled
		if p.fallback != nil {
			if fallbackClaims, fallbackErr := p.fallback.Validate(tokenStr); fallbackErr == nil {
				return fallbackClaims, nil
			}
		}
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	if p.issuer != "" && claims.Issuer != p.issuer {
		return nil, fmt.Errorf("invalid issuer: expected %s, got %s", p.issuer, claims.Issuer)
	}

	if p.audience != "" {
		aud, err := claims.GetAudience()
		if err != nil {
			return nil, fmt.Errorf("failed to get audience: %w", err)
		}
		foundAud := false
		for _, a := range aud {
			if a == p.audience {
				foundAud = true
				break
			}
		}
		if !foundAud {
			return nil, fmt.Errorf("invalid audience: expected %s, got %v", p.audience, aud)
		}
	}

	return claims, nil
}
