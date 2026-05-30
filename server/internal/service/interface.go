package service

import (
	"context"

	"github.com/rolfea/book-buddy/server/internal/data/query"
)

type AddBookInput struct {
	ISBN     string `json:"isbn"`
	Title    string `json:"title"`
	Author   string `json:"author"`
	CoverURL string `json:"cover_url"`
	Status   string `json:"status"`
}

type UpdateStatusInput struct {
	UserBookID    string `json:"user_book_id"`
	Status        string `json:"status"`
	RemovalReason string `json:"removal_reason"`
}

type AddBookResult struct {
	UserBook       query.UserBook `json:"user_book"`
	AlreadyExisted bool           `json:"already_existed"`
	PreviousStatus string         `json:"previous_status,omitempty"` // "owned", "wishlisted", "removed", or ""
}

type BooksServicer interface {
	List(ctx context.Context, userID string) ([]query.GetUserBooksRow, error)
	Add(ctx context.Context, userID string, books []AddBookInput) ([]AddBookResult, error)
	LookupBook(ctx context.Context, isbn string) (*query.Book, error)
	UpdateStatus(ctx context.Context, userID string, input UpdateStatusInput) (query.UserBook, error)
	Remove(ctx context.Context, userID, userBookID string) error
}
