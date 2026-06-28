package data

import (
	"context"
	"database/sql"
	"errors"
	"log"

	"github.com/rolfea/book-buddy/server/internal/data/query"
)

// SeedDefaultData inserts a default test user and a small collection of books
// if the test user does not already exist. If the user exists, it ensures the
// books are seeded if the collection is empty.
func (s *Store) SeedDefaultData(ctx context.Context) error {
	const testEmail = "test@example.com"
	const testExternalID = "auth0|test-user-id"
	const testProvider = "auth0"

	// Define seeded books
	type seedBook struct {
		isbn     string
		title    string
		author   string
		coverURL string
		status   query.BookStatus
	}

	booksToSeed := []seedBook{
		{
			isbn:     "9780743273565",
			title:    "The Great Gatsby",
			author:   "F. Scott Fitzgerald",
			coverURL: "https://covers.openlibrary.org/b/id/8431872-L.jpg",
			status:   query.BookStatusOwned,
		},
		{
			isbn:     "9780451524935",
			title:    "1984",
			author:   "George Orwell",
			coverURL: "https://covers.openlibrary.org/b/id/12836248-L.jpg",
			status:   query.BookStatusOwned,
		},
		{
			isbn:     "9780007440832",
			title:    "The Hobbit",
			author:   "J.R.R. Tolkien",
			coverURL: "https://covers.openlibrary.org/b/id/11435272-L.jpg",
			status:   query.BookStatusWishlisted,
		},
		{
			isbn:     "9780446310789",
			title:    "To Kill a Mockingbird",
			author:   "Harper Lee",
			coverURL: "https://covers.openlibrary.org/b/id/8226191-L.jpg",
			status:   query.BookStatusWishlisted,
		},
	}

	var user query.User
	userExists := true

	// Check if test user already exists
	user, err := s.GetUserByEmail(ctx, testEmail)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			userExists = false
		} else {
			return err
		}
	}

	if !userExists {
		log.Printf("Seeding default testing account (%s)...", testEmail)

		// Use ExecTx transaction to ensure atomicity
		err = s.ExecTx(ctx, func(ctx context.Context, q *query.Queries) error {
			// Create the default user
			createdUser, err := q.CreateUser(ctx, query.CreateUserParams{
				Email:            testEmail,
				ExternalID:       testExternalID,
				ExternalProvider: testProvider,
			})
			if err != nil {
				return err
			}

			// Seed books and associate them with the user
			for _, sb := range booksToSeed {
				var cover sql.NullString
				if sb.coverURL != "" {
					cover = sql.NullString{String: sb.coverURL, Valid: true}
				}

				// Upsert the book into the global books catalog
				book, err := q.UpsertBook(ctx, query.UpsertBookParams{
					Isbn:     sb.isbn,
					Title:    sb.title,
					Author:   sb.author,
					CoverUrl: cover,
				})
				if err != nil {
					return err
				}

				// Associate book with the user's collection
				_, err = q.CreateUserBook(ctx, query.CreateUserBookParams{
					UserID: createdUser.ID,
					BookID: book.ID,
					Status: sb.status,
				})
				if err != nil {
					return err
				}
			}

			return nil
		})

		if err != nil {
			return err
		}

		log.Printf("Successfully seeded default testing account (%s) with %d books", testEmail, len(booksToSeed))
	} else {
		// User exists. Make sure they have books in their collection
		var bookCount int
		err = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM user_books WHERE user_id = $1", user.ID).Scan(&bookCount)
		if err != nil {
			return err
		}

		if bookCount == 0 {
			log.Printf("Seeding book collection for existing default test user (%s)...", testEmail)
			err = s.ExecTx(ctx, func(ctx context.Context, q *query.Queries) error {
				for _, sb := range booksToSeed {
					var cover sql.NullString
					if sb.coverURL != "" {
						cover = sql.NullString{String: sb.coverURL, Valid: true}
					}

					// Upsert the book into the global books catalog
					book, err := q.UpsertBook(ctx, query.UpsertBookParams{
						Isbn:     sb.isbn,
						Title:    sb.title,
						Author:   sb.author,
						CoverUrl: cover,
					})
					if err != nil {
						return err
					}

					// Associate book with the user's collection
					_, err = q.CreateUserBook(ctx, query.CreateUserBookParams{
						UserID: user.ID,
						BookID: book.ID,
						Status: sb.status,
					})
					if err != nil {
						return err
					}
				}
				return nil
			})
			if err != nil {
				return err
			}
			log.Printf("Successfully seeded %d books for existing default test user (%s)", len(booksToSeed), testEmail)
		}
	}

	return nil
}
