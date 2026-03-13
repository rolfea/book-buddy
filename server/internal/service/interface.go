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

type BooksServicer interface {
	List(ctx context.Context, userID string) ([]query.GetUserBooksRow, error)
	Add(ctx context.Context, userID string, books []AddBookInput) ([]query.UserBook, error)
	UpdateStatus(ctx context.Context, userID string, input UpdateStatusInput) (query.UserBook, error)
	Remove(ctx context.Context, userID, userBookID string) error
}
