# TODO

## Shared Collections

Target architecture replaces the `user_books` model with a multi-user collection model:

- `collections` table — a named grouping of books (e.g., "Living Room Shelf", "Household Library")
- `collection_users` — one-to-many join: a collection can have multiple users as members
- `collection_books` — replaces `user_books`; books belong to a collection, not directly to a user

**Migration path:**
1. Create `collections`, `collection_users`, and `collection_books` tables
2. For each existing user, create a default personal collection
3. Migrate all `user_books` rows to `collection_books` under each user's default collection
4. Drop `user_books` once migration is verified

This enables shared ownership scenarios (e.g., two people in a household sharing one library) while keeping personal collections working as a single-member collection.

---

## User Relationships (Friends / Shared Wishlists)

Add a `user_relationships` table to model friend connections, enabling users to view each other's wishlists.

**Implementation notes:**
- `user_relationships` table: `id`, `requester_id` (FK → users), `addressee_id` (FK → users), `status` enum (`pending` | `accepted` | `blocked`), `created_at`
- New service methods: send request, accept/decline, list friends, block user
- New routes under `/user/relationships`
- A `/user/{id}/wishlist` route that returns the target user's wishlisted books, gated by an accepted relationship check in the service layer
- Pairs naturally with Shared Collections — shared wishlists are a read-only view into a friend's collection

---

## Book Location Tracking

Allow users to tag where a physical book is stored (e.g., "bedroom shelf", "storage").

**Implementation notes:**
- `user_locations` table: `id`, `user_id` (FK → users), `location_name`, `created_at`
- Add nullable `location_id` FK column to `user_books` (or `collection_books` if Shared Collections is implemented first)
- New CRUD routes under `/user/locations` to manage location labels
- `PATCH /user/books` should accept an optional `location_id` field alongside `status`
- Surface `location_name` in the `GET /user/books` response via a join

---

## Open Library ETL Pipeline

For MVP, book metadata is fetched from the Open Library API on-demand. Under load this becomes a bottleneck — replace with a local PostgreSQL copy of the Open Library dataset.

**Implementation notes:**
- The Open Library data dump is available as a tab-separated flat file (~tens of GBs)
- Write a one-off import script (or separate `cmd/etl` entrypoint) that parses the dump and bulk-inserts into the `books` table
- Add a `last_synced_at` timestamp to `books` so stale records can be identified and refreshed
- Keep the on-demand API call (`internal/data/openlibrary.go`) as a fallback for ISBNs not present in the local DB
- Open question: what is the right filter to apply when importing — all books, or only those with ISBNs?

---

## Data Abstraction Layer

The current data layer directly exposes sqlc-generated query types to the service layer, coupling business logic to the database implementation.

**Implementation notes:**
- Define a `Repository` interface (or set of interfaces, e.g. `BookRepository`, `UserRepository`) in `internal/data/`
- The sqlc `Store` should implement these interfaces
- The service layer should depend on the interfaces, not the concrete `Store`
- This makes it possible to swap storage backends (e.g., add a Redis cache layer, mock in tests) without touching service logic
- Consider combining with the Shared Collections migration to avoid doing the refactor twice

---

## Image-Based Book Lookup

Allow users to photograph a book's title page as an alternative to barcode scanning, for books without ISBNs or damaged barcodes.

**Implementation notes:**
- Accept an image upload at a new route (e.g., `POST /books/lookup/image`)
- Pass the image to a vision model (e.g., Claude) to extract title and author
- Use the extracted metadata to query Open Library by title/author instead of ISBN
- Return ranked candidate matches for the user to confirm before adding to their collection
- This is post-MVP; defer until barcode scanning proves insufficient in practice
