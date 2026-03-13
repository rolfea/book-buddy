package auth

import "github.com/golang-jwt/jwt/v5"

type Claims struct {
	UserID string `json:"sub"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

type AuthProvider interface {
	Sign(userID, email string) (string, error)
	Validate(token string) (*Claims, error)
}
