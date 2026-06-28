package middleware

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/rolfea/book-buddy/server/internal/auth"
	"github.com/rolfea/book-buddy/server/internal/data/query"
)

type contextKey string

const claimsKey contextKey = "claims"

type UserStore interface {
	GetUserByExternalID(ctx context.Context, externalID string) (query.User, error)
	CreateUser(ctx context.Context, arg query.CreateUserParams) (query.User, error)
}

func RequireAuth(provider auth.AuthProvider, store UserStore) Middleware {
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

			// Map Auth0/external ID to our internal UUID database ID
			ctx := r.Context()
			dbUser, err := store.GetUserByExternalID(ctx, claims.UserID)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
					return
				}
				http.Error(w, `{"error":"database error during auth lookup"}`, http.StatusInternalServerError)
				return
			}

			// Mutate claims to hold internal DB values so downstream handlers work seamlessly
			claims.UserID = dbUser.ID.String()
			claims.Email = dbUser.Email

			ctx = context.WithValue(ctx, claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ClaimsFromContext(ctx context.Context) (*auth.Claims, bool) {
	c, ok := ctx.Value(claimsKey).(*auth.Claims)
	return c, ok
}
