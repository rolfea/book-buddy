-- name: GetUserBooks :many
SELECT ub.id, ub.user_id, ub.book_id, ub.status, ub.created_at,
       b.isbn, b.title, b.author, b.cover_url
FROM user_books ub
JOIN books b ON b.id = ub.book_id
WHERE ub.user_id = $1 AND ub.status != 'removed';

-- name: UpsertBook :one
INSERT INTO books (isbn, title, author, cover_url)
VALUES ($1, $2, $3, $4)
ON CONFLICT (isbn) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    cover_url = EXCLUDED.cover_url
RETURNING *;

-- name: CreateUserBook :one
INSERT INTO user_books (user_id, book_id, status)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, book_id) DO UPDATE SET status = EXCLUDED.status
RETURNING *;

-- name: GetUserBookByID :one
SELECT * FROM user_books
WHERE id = $1 AND user_id = $2;

-- name: UpdateUserBookStatus :one
UPDATE user_books SET status = $3
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: InsertRemovalReason :one
INSERT INTO removal_reasons (user_book_id, reason)
VALUES ($1, $2)
RETURNING *;

-- name: DeleteUserBook :exec
DELETE FROM user_books
WHERE id = $1 AND user_id = $2;

-- name: CreateUser :one
INSERT INTO users (email, password_hash)
VALUES ($1, $2)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;
