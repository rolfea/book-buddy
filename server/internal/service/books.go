package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/rolfea/book-buddy/server/internal/data"
	"github.com/rolfea/book-buddy/server/internal/data/query"
)

var ErrNotFound = errors.New("not found")
var ErrBadRequest = errors.New("bad request")

type BooksService struct {
	store *data.Store
}

func NewBooksService(store *data.Store) *BooksService {
	return &BooksService{store: store}
}

func (s *BooksService) List(ctx context.Context, userID string) ([]query.GetUserBooksRow, error) {
	return s.store.GetUserBooks(ctx, userID)
}

func (s *BooksService) Add(ctx context.Context, userID string, books []AddBookInput) ([]query.UserBook, error) {
	var results []query.UserBook
	for _, b := range books {
		status := query.BookStatusWishlisted
		switch b.Status {
		case "owned":
			status = query.BookStatusOwned
		case "removed":
			status = query.BookStatusRemoved
		}

		var coverURL sql.NullString
		if b.CoverURL != "" {
			coverURL = sql.NullString{String: b.CoverURL, Valid: true}
		}

		book, err := s.store.UpsertBook(ctx, query.UpsertBookParams{
			Isbn:     b.ISBN,
			Title:    b.Title,
			Author:   b.Author,
			CoverUrl: coverURL,
		})
		if err != nil {
			return nil, fmt.Errorf("upsert book: %w", err)
		}

		ub, err := s.store.CreateUserBook(ctx, query.CreateUserBookParams{
			UserID: userID,
			BookID: book.ID,
			Status: status,
		})
		if err != nil {
			return nil, fmt.Errorf("create user book: %w", err)
		}
		results = append(results, ub)
	}
	return results, nil
}

func (s *BooksService) UpdateStatus(ctx context.Context, userID string, input UpdateStatusInput) (query.UserBook, error) {
	if input.Status == "removed" && input.RemovalReason == "" {
		return query.UserBook{}, fmt.Errorf("%w: removal_reason required when status is 'removed'", ErrBadRequest)
	}

	var result query.UserBook
	err := s.store.ExecTx(ctx, func(ctx context.Context, q *query.Queries) error {
		ub, err := q.GetUserBookByID(ctx, query.GetUserBookByIDParams{
			ID:     input.UserBookID,
			UserID: userID,
		})
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}

		updated, err := q.UpdateUserBookStatus(ctx, query.UpdateUserBookStatusParams{
			ID:     ub.ID,
			UserID: userID,
			Status: query.BookStatus(input.Status),
		})
		if err != nil {
			return err
		}

		if input.Status == "removed" {
			_, err = q.InsertRemovalReason(ctx, query.InsertRemovalReasonParams{
				UserBookID: ub.ID,
				Reason:     input.RemovalReason,
			})
			if err != nil {
				return err
			}
		}

		result = updated
		return nil
	})
	return result, err
}

func (s *BooksService) Remove(ctx context.Context, userID, userBookID string) error {
	return s.store.DeleteUserBook(ctx, query.DeleteUserBookParams{
		ID:     userBookID,
		UserID: userID,
	})
}
