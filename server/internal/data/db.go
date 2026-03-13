package data

import (
	"context"
	"database/sql"

	"github.com/rolfea/book-buddy/server/internal/data/query"
)

type Store struct {
	*query.Queries
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{
		Queries: query.New(db),
		db:      db,
	}
}

type TxFunc func(ctx context.Context, q *query.Queries) error

func (s *Store) ExecTx(ctx context.Context, fn TxFunc) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	q := s.Queries.WithTx(tx)
	if err := fn(ctx, q); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
