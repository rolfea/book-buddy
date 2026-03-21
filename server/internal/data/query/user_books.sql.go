package query

import (
	"context"
	"database/sql"
)

const getUserBooks = `
SELECT ub.id, ub.user_id, ub.book_id, ub.status, ub.created_at,
       b.isbn, b.title, b.author, b.cover_url
FROM user_books ub
JOIN books b ON b.id = ub.book_id
WHERE ub.user_id = $1 AND ub.status != 'removed'
`

func (q *Queries) GetUserBooks(ctx context.Context, userID string) ([]GetUserBooksRow, error) {
	rows, err := q.db.QueryContext(ctx, getUserBooks, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []GetUserBooksRow
	for rows.Next() {
		var i GetUserBooksRow
		if err := rows.Scan(
			&i.ID, &i.UserID, &i.BookID, &i.Status, &i.CreatedAt,
			&i.Isbn, &i.Title, &i.Author, &i.CoverUrl,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const upsertBook = `
INSERT INTO books (isbn, title, author, cover_url)
VALUES ($1, $2, $3, $4)
ON CONFLICT (isbn) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    cover_url = EXCLUDED.cover_url
RETURNING id, isbn, title, author, cover_url, created_at
`

type UpsertBookParams struct {
	Isbn     string         `json:"isbn"`
	Title    string         `json:"title"`
	Author   string         `json:"author"`
	CoverUrl sql.NullString `json:"cover_url"`
}

func (q *Queries) UpsertBook(ctx context.Context, arg UpsertBookParams) (Book, error) {
	row := q.db.QueryRowContext(ctx, upsertBook, arg.Isbn, arg.Title, arg.Author, arg.CoverUrl)
	var b Book
	err := row.Scan(&b.ID, &b.Isbn, &b.Title, &b.Author, &b.CoverUrl, &b.CreatedAt)
	return b, err
}

const createUserBook = `
INSERT INTO user_books (user_id, book_id, status)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, book_id) DO UPDATE SET status = EXCLUDED.status
RETURNING id, user_id, book_id, status, created_at
`

type CreateUserBookParams struct {
	UserID string     `json:"user_id"`
	BookID string     `json:"book_id"`
	Status BookStatus `json:"status"`
}

func (q *Queries) CreateUserBook(ctx context.Context, arg CreateUserBookParams) (UserBook, error) {
	row := q.db.QueryRowContext(ctx, createUserBook, arg.UserID, arg.BookID, arg.Status)
	var ub UserBook
	err := row.Scan(&ub.ID, &ub.UserID, &ub.BookID, &ub.Status, &ub.CreatedAt)
	return ub, err
}

const getUserBookByID = `
SELECT id, user_id, book_id, status, created_at FROM user_books
WHERE id = $1 AND user_id = $2
`

type GetUserBookByIDParams struct {
	ID     string `json:"id"`
	UserID string `json:"user_id"`
}

func (q *Queries) GetUserBookByID(ctx context.Context, arg GetUserBookByIDParams) (UserBook, error) {
	row := q.db.QueryRowContext(ctx, getUserBookByID, arg.ID, arg.UserID)
	var ub UserBook
	err := row.Scan(&ub.ID, &ub.UserID, &ub.BookID, &ub.Status, &ub.CreatedAt)
	return ub, err
}

const updateUserBookStatus = `
UPDATE user_books SET status = $3
WHERE id = $1 AND user_id = $2
RETURNING id, user_id, book_id, status, created_at
`

type UpdateUserBookStatusParams struct {
	ID     string     `json:"id"`
	UserID string     `json:"user_id"`
	Status BookStatus `json:"status"`
}

func (q *Queries) UpdateUserBookStatus(ctx context.Context, arg UpdateUserBookStatusParams) (UserBook, error) {
	row := q.db.QueryRowContext(ctx, updateUserBookStatus, arg.ID, arg.UserID, arg.Status)
	var ub UserBook
	err := row.Scan(&ub.ID, &ub.UserID, &ub.BookID, &ub.Status, &ub.CreatedAt)
	return ub, err
}

const insertRemovalReason = `
INSERT INTO removal_reasons (user_book_id, reason)
VALUES ($1, $2)
RETURNING id, user_book_id, reason, created_at
`

type InsertRemovalReasonParams struct {
	UserBookID string `json:"user_book_id"`
	Reason     string `json:"reason"`
}

func (q *Queries) InsertRemovalReason(ctx context.Context, arg InsertRemovalReasonParams) (RemovalReason, error) {
	row := q.db.QueryRowContext(ctx, insertRemovalReason, arg.UserBookID, arg.Reason)
	var r RemovalReason
	err := row.Scan(&r.ID, &r.UserBookID, &r.Reason, &r.CreatedAt)
	return r, err
}

const deleteUserBook = `
DELETE FROM user_books WHERE id = $1 AND user_id = $2
`

type DeleteUserBookParams struct {
	ID     string `json:"id"`
	UserID string `json:"user_id"`
}

func (q *Queries) DeleteUserBook(ctx context.Context, arg DeleteUserBookParams) error {
	_, err := q.db.ExecContext(ctx, deleteUserBook, arg.ID, arg.UserID)
	return err
}

const createUser = `
INSERT INTO users (email, password_hash)
VALUES ($1, $2)
RETURNING id, email, password_hash, created_at
`

type CreateUserParams struct {
	Email        string `json:"email"`
	PasswordHash string `json:"password_hash"`
}

func (q *Queries) CreateUser(ctx context.Context, arg CreateUserParams) (User, error) {
	row := q.db.QueryRowContext(ctx, createUser, arg.Email, arg.PasswordHash)
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	return u, err
}

const getUserByEmail = `
SELECT id, email, password_hash, created_at FROM users WHERE email = $1
`

func (q *Queries) GetUserByEmail(ctx context.Context, email string) (User, error) {
	row := q.db.QueryRowContext(ctx, getUserByEmail, email)
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	return u, err
}
