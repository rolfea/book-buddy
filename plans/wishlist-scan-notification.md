# Plan: Wishlist Scan Match & Notifications

## Objective
When a user scans a book at a bookstore or library, automatically notify them if the book is already on their wishlist.

## Technical Architecture

### 1. Database & SQL Queries (`server/sql/queries/user_books.sql`)
Add a query to look up the current user's existing relationship with the scanned book:
- **`GetUserBookByISBN`**: Determines if the current user already has this book in their library and what its status is.

> [!NOTE]
> **Future Enhancement (Friends/Networks):** 
> Checked-in and tracked under `server/TODO.md` in the **User Relationships (Friends / Shared Wishlists)** roadmap section. We will implement friends' wishlist query matching once the relationship schema is created.

### 2. Service Layer (`server/internal/service/`)
- Define `AddBookResult` struct containing:
  - `UserBook` (`query.UserBook`)
  - `AlreadyExisted` (`bool`)
  - `PreviousStatus` (`string`)
- Update `Add` in `BooksServicer` and `BooksService` to query `GetUserBookByISBN` for the current user before executing the standard upsert operations.

### 3. Controller Layer (`server/internal/controller/`)
- Update `/user/books` (`POST`) controller to handle the new return signature from the `Add` service, mapping the `AddBookResult` items into the response.

### 4. Client Components (`web-client/`)
- **`isbn-scanner.js`**: Add a modern `.overlay.wishlist-match` styled with golden-amber hues, showing that the scanned item was already on the user's wishlist. Incorporate a safe, programmatic DOM construction pattern to avoid security/XSS linters.
- **`scanner.js`**: Parse the REST response, extract the database `userBookId` and save it to the session scans. If a match occurs, trigger custom HUD overlays.
  - **Dynamic Action Buttons:** Add `"Mark Owned"` and `"Remove"` buttons on the history items. Clicking `"Mark Owned"` sends a `PATCH` request to update status and dynamically updates the history item styling to `"Already Owned"`. Clicking `"Remove"` deletes the book record from the DB and removes it from the list immediately in-place.
- **`styles.css`**: Create customized visual indicators for `.scanned-book-item.wishlist-match` and `.scanned-book-item.owned-match` items, along with elegant styling for the dynamic action buttons.

## Development Tasks & Progress
- [x] Write SQL queries in `server/sql/queries/user_books.sql`
- [x] Run `sqlc generate` to compile DB operations
- [x] Update Go interface and books service logic in `server/internal/service/`
- [x] Refactor Go controller in `server/internal/controller/books.go`
- [x] Add golden HUD styles and `markWishlistMatch` method in `web-client/components/isbn-scanner.js`
- [x] Update `web-client/pages/scanner.js` with match-detection logic and UI history integration
- [x] Update `web-client/styles.css` with golden theme styling for matched items
- [x] Verify Go and Frontend tests pass
- [x] Perform manual verification (scan a wishlisted book and confirm golden notification appears)
- [x] Add dynamic "Mark Owned" and "Remove" action buttons to the session scanner history list
