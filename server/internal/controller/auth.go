package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/rolfea/book-buddy/server/internal/auth"
	"github.com/rolfea/book-buddy/server/internal/data"
	"github.com/rolfea/book-buddy/server/internal/data/query"
	"github.com/rolfea/book-buddy/server/internal/middleware"
	"golang.org/x/crypto/bcrypt"
)

type AuthController struct {
	store         *data.Store
	provider      auth.AuthProvider
	secureCookies bool
}

func NewAuthController(store *data.Store, provider auth.AuthProvider, secureCookies bool) *AuthController {
	return &AuthController{store: store, provider: provider, secureCookies: secureCookies}
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string `json:"token"`
}

func (c *AuthController) setAuthCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   c.secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600 * 24 * 3, // 3 days
	})
}

func (c *AuthController) Register(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	user, err := c.store.CreateUser(r.Context(), query.CreateUserParams{
		Email:        req.Email,
		PasswordHash: string(hash),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create user")
		return
	}

	token, err := c.provider.Sign(user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not sign token")
		return
	}

	c.setAuthCookie(w, token)
	writeJSON(w, http.StatusCreated, authResponse{Token: token})
}

func (c *AuthController) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := c.store.GetUserByEmail(r.Context(), req.Email)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := c.provider.Sign(user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not sign token")
		return
	}

	c.setAuthCookie(w, token)
	writeJSON(w, http.StatusOK, authResponse{Token: token})
}

func (c *AuthController) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (c *AuthController) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// Just return the claims for now, or fetch full user from DB if needed
	writeJSON(w, http.StatusOK, map[string]string{
		"id":    claims.UserID,
		"email": claims.Email,
	})
}
