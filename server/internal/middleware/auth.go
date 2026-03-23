package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/rolfea/book-buddy/server/internal/auth"
)

type contextKey string

const claimsKey contextKey = "claims"

func RequireAuth(provider auth.AuthProvider) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var tokenStr string

			// 1. Check Authorization header
			header := r.Header.Get("Authorization")
			if strings.HasPrefix(header, "Bearer ") {
				tokenStr = strings.TrimPrefix(header, "Bearer ")
			}

			// 2. Fallback to cookie
			if tokenStr == "" {
				cookie, err := r.Cookie("token")
				if err == nil {
					tokenStr = cookie.Value
				}
			}

			if tokenStr == "" {
				http.Error(w, `{"error":"missing or invalid authorization"}`, http.StatusUnauthorized)
				return
			}

			claims, err := provider.Validate(tokenStr)
			if err != nil {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ClaimsFromContext(ctx context.Context) (*auth.Claims, bool) {
	c, ok := ctx.Value(claimsKey).(*auth.Claims)
	return c, ok
}
