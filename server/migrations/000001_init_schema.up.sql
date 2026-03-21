CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE books (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    isbn       TEXT        NOT NULL UNIQUE,
    title      TEXT        NOT NULL,
    author     TEXT        NOT NULL,
    cover_url  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE book_status AS ENUM ('owned', 'wishlisted', 'removed');

CREATE TABLE user_books (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id    UUID        NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    status     book_status NOT NULL DEFAULT 'wishlisted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, book_id)
);

CREATE TABLE removal_reasons (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_book_id UUID        NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
    reason       TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_books_user_id ON user_books(user_id);
