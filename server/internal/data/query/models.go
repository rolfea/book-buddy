package query

import (
	"database/sql"
	"time"
)

type BookStatus string

const (
	BookStatusOwned      BookStatus = "owned"
	BookStatusWishlisted BookStatus = "wishlisted"
	BookStatusRemoved    BookStatus = "removed"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"password_hash"`
	CreatedAt    time.Time `json:"created_at"`
}

type Book struct {
	ID        string         `json:"id"`
	Isbn      string         `json:"isbn"`
	Title     string         `json:"title"`
	Author    string         `json:"author"`
	CoverUrl  sql.NullString `json:"cover_url"`
	CreatedAt time.Time      `json:"created_at"`
}

type UserBook struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	BookID    string     `json:"book_id"`
	Status    BookStatus `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
}

type RemovalReason struct {
	ID         string    `json:"id"`
	UserBookID string    `json:"user_book_id"`
	Reason     string    `json:"reason"`
	CreatedAt  time.Time `json:"created_at"`
}

type GetUserBooksRow struct {
	ID        string         `json:"id"`
	UserID    string         `json:"user_id"`
	BookID    string         `json:"book_id"`
	Status    BookStatus     `json:"status"`
	CreatedAt time.Time      `json:"created_at"`
	Isbn      string         `json:"isbn"`
	Title     string         `json:"title"`
	Author    string         `json:"author"`
	CoverUrl  sql.NullString `json:"cover_url"`
}
