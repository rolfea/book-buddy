package controller

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rolfea/book-buddy/server/internal/auth"
	"github.com/rolfea/book-buddy/server/internal/data"
	"github.com/rolfea/book-buddy/server/internal/data/query"
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
	sameSite := http.SameSiteLaxMode
	if c.secureCookies {
		sameSite = http.SameSiteNoneMode
	}
	// #nosec G124 - Secure is configurable via config to support local mobile testing over HTTP
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   c.secureCookies,
		SameSite: sameSite,
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

	// Exchange code with Auth0 (support mock http server in unit tests)
	scheme := "https"
	if strings.HasPrefix(c.auth0Domain, "127.0.0.1") || strings.HasPrefix(c.auth0Domain, "localhost") {
		scheme = "http"
	}
	tokenURL := fmt.Sprintf("%s://%s/oauth/token", scheme, c.auth0Domain)

	payload := map[string]string{
		"grant_type":    "authorization_code",
		"client_id":     c.auth0ClientID,
		"code":          req.Code,
		"code_verifier": req.CodeVerifier,
		"redirect_uri":  c.auth0CallbackURL,
	}
	if c.auth0ClientSecret != "" {
		payload["client_secret"] = c.auth0ClientSecret
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
		log.Printf("Auth0 token exchange failed with status %d: %v", resp.StatusCode, errResp)
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

	// Parse unverified ID Token to extract claims (sub/email) for provisioning
	parser := jwt.NewParser()
	var claims auth.Claims
	_, _, err = parser.ParseUnverified(tokenResp.IDToken, &claims)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse id token")
		return
	}

	if claims.UserID == "" {
		writeError(w, http.StatusBadRequest, "invalid user id in id token")
		return
	}

	// Provision user dynamically if they don't exist yet
	ctx := r.Context()
	_, err = c.store.GetUserByExternalID(ctx, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			_, err = c.store.CreateUser(ctx, query.CreateUserParams{
				Email:            claims.Email,
				ExternalID:       claims.UserID,
				ExternalProvider: "auth0",
			})
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to provision user")
				return
			}
		} else {
			writeError(w, http.StatusInternalServerError, "database error during user check")
			return
		}
	}

	// Set the ID Token as our HttpOnly auth cookie
	c.setAuthCookie(w, tokenResp.IDToken)

	writeJSON(w, http.StatusOK, callbackResponse{Success: true})
}

func (c *AuthController) Logout(w http.ResponseWriter, r *http.Request) {
	sameSite := http.SameSiteLaxMode
	if c.secureCookies {
		sameSite = http.SameSiteNoneMode
	}
	// #nosec G124 - Secure is configurable via config to support local mobile testing over HTTP
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   c.secureCookies,
		SameSite: sameSite,
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

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string `json:"token"`
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

	ctx := r.Context()
	user, err := c.store.GetUserByExternalID(ctx, "test|"+req.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			user, err = c.store.CreateUser(ctx, query.CreateUserParams{
				Email:            req.Email,
				ExternalID:       "test|" + req.Email,
				ExternalProvider: "test-provider",
			})
			if err != nil {
				writeError(w, http.StatusInternalServerError, "could not create user")
				return
			}
		} else {
			writeError(w, http.StatusInternalServerError, "database error")
			return
		}
	}

	token, err := c.provider.Sign(user.ExternalID, user.Email)
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
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password required")
		return
	}

	ctx := r.Context()
	user, err := c.store.GetUserByExternalID(ctx, "test|"+req.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}

	token, err := c.provider.Sign(user.ExternalID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not sign token")
		return
	}

	c.setAuthCookie(w, token)
	writeJSON(w, http.StatusOK, authResponse{Token: token})
}
