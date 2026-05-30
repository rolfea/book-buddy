package middleware

import (
	"log"
	"net/http"
	"strings"
	"time"
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(status int) {
	rw.status = status
	rw.ResponseWriter.WriteHeader(status)
}

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		
		escapedMethod := strings.ReplaceAll(strings.ReplaceAll(r.Method, "\n", ""), "\r", "")
		escapedPath := strings.ReplaceAll(strings.ReplaceAll(r.URL.Path, "\n", ""), "\r", "")
		
		log.Printf("%s %s %d %s", escapedMethod, escapedPath, rw.status, time.Since(start))
	})
}
