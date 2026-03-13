package controller

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/rolfea/book-buddy/server/internal/data/query"
	"github.com/rolfea/book-buddy/server/internal/middleware"
	"github.com/rolfea/book-buddy/server/internal/service"
)

type BooksController struct {
	svc service.BooksServicer
}

func NewBooksController(svc service.BooksServicer) *BooksController {
	return &BooksController{svc: svc}
}

func (c *BooksController) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	books, err := c.svc.List(r.Context(), claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if books == nil {
		books = []query.GetUserBooksRow{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"books": books})
}

type addBooksRequest struct {
	Books []service.AddBookInput `json:"books"`
}

func (c *BooksController) Add(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req addBooksRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.Books) == 0 {
		writeError(w, http.StatusBadRequest, "books array required")
		return
	}

	results, err := c.svc.Add(r.Context(), claims.UserID, req.Books)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{"user_books": results})
}

type updateStatusRequest struct {
	UserBookID    string `json:"user_book_id"`
	Status        string `json:"status"`
	RemovalReason string `json:"removal_reason"`
}

func (c *BooksController) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req updateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserBookID == "" || req.Status == "" {
		writeError(w, http.StatusBadRequest, "user_book_id and status required")
		return
	}

	updated, err := c.svc.UpdateStatus(r.Context(), claims.UserID, service.UpdateStatusInput{
		UserBookID:    req.UserBookID,
		Status:        req.Status,
		RemovalReason: req.RemovalReason,
	})
	if err != nil {
		if errors.Is(err, service.ErrBadRequest) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if errors.Is(err, service.ErrNotFound) {
			writeError(w, http.StatusNotFound, "user book not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

type removeBookRequest struct {
	UserBookID string `json:"user_book_id"`
}

func (c *BooksController) Remove(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req removeBookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserBookID == "" {
		writeError(w, http.StatusBadRequest, "user_book_id required")
		return
	}

	if err := c.svc.Remove(r.Context(), claims.UserID, req.UserBookID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
