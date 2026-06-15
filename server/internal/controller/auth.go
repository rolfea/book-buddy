package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rolfea/book-buddy/server/internal/auth"
	"github.com/rolfea/book-buddy/server/internal/data"
	"github.com/rolfea/book-buddy/server/internal/middleware"
)

type AuthController struct {
	store             *data.Store
	provider          auth.AuthProvider
	secureCookies     bool
	auth0Domain       string
	auth0ClientID     string
	auth0ClientSecret string
	auth0CallbackURL  string
}

func NewAuthController(
	store *data.Store,
	provider auth.AuthProvider,
	secureCookies bool,
	auth0Domain string,
	auth0ClientID string,
	auth0ClientSecret string,
	auth0CallbackURL string,
) *AuthController {
	return &AuthController{
		store:             store,
		provider:          provider,
		secureCookies:     secureCookies,
		auth0Domain:       auth0Domain,
		auth0ClientID:     auth0ClientID,
		auth0ClientSecret: auth0ClientSecret,
		auth0CallbackURL:  auth0CallbackURL,
	}
}

func (c *AuthController) setAuthCookie(w http.ResponseWriter, token string) {
	// #nosec G124 - Secure is configurable via config to support local mobile testing over HTTP
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

type callbackRequest struct {
	Code         string `json:"code"`
	CodeVerifier string `json:"code_verifier"`
}

type callbackResponse struct {
	Success bool `json:"success"`
}

func (c *AuthController) Callback(w http.ResponseWriter, r *http.Request) {
	var req callbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Code == "" || req.CodeVerifier == "" {
		writeError(w, http.StatusBadRequest, "code and code_verifier required")
		return
	}

	// Exchange code with Auth0
	tokenURL := fmt.Sprintf("https://%s/oauth/token", c.auth0Domain)
	payload := map[string]string{
		"grant_type":    "authorization_code",
		"client_id":     c.auth0ClientID,
		"client_secret": c.auth0ClientSecret,
		"code":          req.Code,
		"code_verifier": req.CodeVerifier,
		"redirect_uri":  c.auth0CallbackURL,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	resp, err := http.Post(tokenURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to contact auth0")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		writeError(w, http.StatusBadRequest, "failed to exchange code")
		return
	}

	var tokenResp struct {
		IDToken     string `json:"id_token"`
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to decode token response")
		return
	}

	// Set the ID token as our HttpOnly auth cookie
	// The middleware will validate this token
	c.setAuthCookie(w, tokenResp.IDToken)

	writeJSON(w, http.StatusOK, callbackResponse{Success: true})
}

func (c *AuthController) Logout(w http.ResponseWriter, r *http.Request) {
	// #nosec G124 - Secure is configurable via config to support local mobile testing over HTTP
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   c.secureCookies,
		SameSite: http.SameSiteLaxMode,
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

	writeJSON(w, http.StatusOK, map[string]string{
		"id":    claims.UserID,
		"email": claims.Email,
	})
}
