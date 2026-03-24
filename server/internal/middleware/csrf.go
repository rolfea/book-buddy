package middleware

import "net/http"

func CSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only check for state-changing methods
		if r.Method != http.MethodGet && r.Method != http.MethodOptions && r.Method != http.MethodHead {
			if r.Header.Get("X-BookBuddy-Request") != "true" {
				http.Error(w, `{"error":"invalid or missing CSRF header"}`, http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
