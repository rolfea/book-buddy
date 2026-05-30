package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rolfea/book-buddy/server/internal/data"
	"github.com/rolfea/book-buddy/server/internal/data/query"
)

var ErrNotFound = errors.New("not found")
var ErrBadRequest = errors.New("bad request")

const UnknownBookPlaceholder = "Unknown"

type BooksService struct {
	store         *data.Store
	libraryClient data.BookMetadataClient
}

func NewBooksService(store *data.Store, libraryClient data.BookMetadataClient) *BooksService {
	return &BooksService{store: store, libraryClient: libraryClient}
}

func (s *BooksService) List(ctx context.Context, userID string) ([]query.GetUserBooksRow, error) {
	uID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid user id: %v", ErrBadRequest, err)
	}
	return s.store.GetUserBooks(ctx, uID)
}

func (s *BooksService) LookupBook(ctx context.Context, isbn string) (*query.Book, error) {
	// 1. Check local DB (only hit cache if we have valid metadata)
	book, err := s.store.GetBookByISBN(ctx, isbn)
	if err == nil && book.Title != "" && book.Title != UnknownBookPlaceholder {
		return &book, nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("get book by isbn: %w", err)
	}

	// 2. Fallback to OpenLibrary API
	meta, err := s.libraryClient.FetchByISBN(isbn)
	if err != nil {
		return nil, fmt.Errorf("fetch book from library client: %w", err)
	}
	if meta == nil {
		return nil, ErrNotFound
	}

	// 3. Save (cache) in local DB
	var coverURL sql.NullString
	if meta.CoverURL != "" {
		coverURL = sql.NullString{String: meta.CoverURL, Valid: true}
	}
	newBook, err := s.store.UpsertBook(ctx, query.UpsertBookParams{
		Isbn:     meta.ISBN,
		Title:    meta.Title,
		Author:   meta.Author,
		CoverUrl: coverURL,
	})
	if err != nil {
		return nil, fmt.Errorf("cache book in db: %w", err)
	}

	return &newBook, nil
}

func (s *BooksService) Add(ctx context.Context, userID string, books []AddBookInput) ([]AddBookResult, error) {
	uID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid user id: %v", ErrBadRequest, err)
	}

	var results []AddBookResult
	for _, b := range books {
		targetStatus := query.BookStatusWishlisted
		switch b.Status {
		case "owned":
			targetStatus = query.BookStatusOwned
		case "removed":
			targetStatus = query.BookStatusRemoved
		}

		// 1. Check if the user already has this book in their library
		var alreadyExisted bool
		var previousStatus string
		var status = targetStatus

		existingUB, err := s.store.GetUserBookByISBN(ctx, query.GetUserBookByISBNParams{
			UserID: uID,
			Isbn:   b.ISBN,
		})
		if err == nil {
			alreadyExisted = true
			previousStatus = string(existingUB.Status)
			// Preserve the status if it's already owned or wishlisted (prevent scan-demotion)
			if existingUB.Status == query.BookStatusOwned || existingUB.Status == query.BookStatusWishlisted {
				status = existingUB.Status
			}
		} else if !errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("check existing user book: %w", err)
		}

		// Look up existing book or resolve it to prevent overwriting with "Unknown"
		var book query.Book
		var hasLocalMetadata bool

		localBook, err := s.store.GetBookByISBN(ctx, b.ISBN)
		if err == nil && localBook.Title != "" && localBook.Title != UnknownBookPlaceholder {
			book = localBook
			hasLocalMetadata = true
		}

		if !hasLocalMetadata {
			resolvedBook, err := s.LookupBook(ctx, b.ISBN)
			if err == nil {
				book = *resolvedBook
			} else {
				// Fallback: use whatever the client sent
				var coverURL sql.NullString
				if b.CoverURL != "" {
					coverURL = sql.NullString{String: b.CoverURL, Valid: true}
				}
				book, err = s.store.UpsertBook(ctx, query.UpsertBookParams{
					Isbn:     b.ISBN,
					Title:    b.Title,
					Author:   b.Author,
					CoverUrl: coverURL,
				})
				if err != nil {
					return nil, fmt.Errorf("upsert fallback book: %w", err)
				}
			}
		}

		ub, err := s.store.CreateUserBook(ctx, query.CreateUserBookParams{
			UserID: uID,
			BookID: book.ID,
			Status: status,
		})
		if err != nil {
			return nil, fmt.Errorf("create user book: %w", err)
		}
		results = append(results, AddBookResult{
			UserBook:       ub,
			AlreadyExisted: alreadyExisted,
			PreviousStatus: previousStatus,
		})
	}
	return results, nil
}

func (s *BooksService) UpdateStatus(ctx context.Context, userID string, input UpdateStatusInput) (query.UserBook, error) {
	if input.Status == "removed" && input.RemovalReason == "" {
		return query.UserBook{}, fmt.Errorf("%w: removal_reason required when status is 'removed'", ErrBadRequest)
	}

	uID, err := uuid.Parse(userID)
	if err != nil {
		return query.UserBook{}, fmt.Errorf("%w: invalid user id: %v", ErrBadRequest, err)
	}

	ubID, err := uuid.Parse(input.UserBookID)
	if err != nil {
		return query.UserBook{}, fmt.Errorf("%w: invalid user book id: %v", ErrBadRequest, err)
	}

	var result query.UserBook
	err = s.store.ExecTx(ctx, func(ctx context.Context, q *query.Queries) error {
		ub, err := q.GetUserBookByID(ctx, query.GetUserBookByIDParams{
			ID:     ubID,
			UserID: uID,
		})
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}

		updated, err := q.UpdateUserBookStatus(ctx, query.UpdateUserBookStatusParams{
			ID:     ub.ID,
			UserID: uID,
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
	uID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("%w: invalid user id: %v", ErrBadRequest, err)
	}

	ubID, err := uuid.Parse(userBookID)
	if err != nil {
		return fmt.Errorf("%w: invalid user book id: %v", ErrBadRequest, err)
	}

	return s.store.DeleteUserBook(ctx, query.DeleteUserBookParams{
		ID:     ubID,
		UserID: uID,
	})
}
