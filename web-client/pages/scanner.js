import { request, parseNullString } from "../api.js";
import "../components/isbn-scanner.js";

// Session-specific array of scanned books
let sessionScannedBooks = [];

export function render(container) {
  // Reset session list if entering the page fresh
  sessionScannedBooks = [];

  container.innerHTML = `
    <div class="scanner-header">
      <h1>Scanner View</h1>
      <button id="btn-go-books">Go to My Books</button>
    </div>
    <div class="scanner-container">
      <div class="scanner-pane">
        <isbn-scanner id="book-scanner"></isbn-scanner>
      </div>
      <div class="scanned-pane">
        <div class="scanned-title">
          <span>Scanned in this Session</span>
          <span id="scanned-badge" class="scanned-count" style="display: none;">0</span>
        </div>
        <div id="scanned-list" class="scanned-history">
          <div class="empty-state">No books scanned yet in this session. Barcodes will appear here as soon as you scan them.</div>
        </div>
      </div>
    </div>
  `;

  const scanner = container.querySelector("#book-scanner");
  const listEl = container.querySelector("#scanned-list");
  const badgeEl = container.querySelector("#scanned-badge");
  const goBooksBtn = container.querySelector("#btn-go-books");

  goBooksBtn.addEventListener("click", () => {
    window.location.hash = "#/books";
  });

  scanner.addEventListener("isbn-detected", async (e) => {
    const isbn = e.detail.isbn;
    const itemId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 1. Add loading state to history queue
    const queueItem = {
      id: itemId,
      isbn,
      title: "Resolving metadata...",
      author: "Please wait",
      coverUrl: null,
      status: "loading",
    };
    sessionScannedBooks.unshift(queueItem);
    renderSessionList(listEl, badgeEl);

    try {
      // 2. Add to library (Go backend will auto-fetch and cache details)
      const res = await request("POST", "/user/books", {
        books: [{ isbn, status: "wishlisted" }],
      });

      let alreadyExisted = false;
      let previousStatus = "";
      let userBookId = null;
      if (res && res.user_books && res.user_books.length > 0) {
        alreadyExisted = res.user_books[0].already_existed;
        previousStatus = res.user_books[0].previous_status;
        userBookId = res.user_books[0].user_book.id;
      }

      // 3. Fetch full book metadata to display locally
      let bookDetails = { title: "Unknown Title", author: "Unknown Author", coverUrl: null };
      try {
        const book = await request("GET", `/api/books/lookup?isbn=${isbn}`);
        if (book) {
          bookDetails = {
            title: book.title || "Unknown Title",
            author: book.author || "Unknown Author",
            coverUrl: parseNullString(book.cover_url) || null,
          };
        }
      } catch (lookupErr) {
        console.warn(`Metadata lookup failed for scanned book ${isbn}:`, lookupErr);
        bookDetails = {
          title: "[Metadata Lookup Failed]",
          author: "[Unknown Author]",
          coverUrl: null,
        };
      }

      // 4. Mark success in history and trigger HUD indicator
      const itemIndex = sessionScannedBooks.findIndex(item => item.id === itemId);
      let listStatus = "success";
      if (alreadyExisted && previousStatus === "wishlisted") {
        listStatus = "wishlist-match";
      } else if (alreadyExisted && previousStatus === "owned") {
        listStatus = "owned-match";
      }

      if (itemIndex !== -1) {
        sessionScannedBooks[itemIndex] = {
          ...sessionScannedBooks[itemIndex],
          ...bookDetails,
          status: listStatus,
          userBookId: userBookId,
        };
      }
      renderSessionList(listEl, badgeEl);

      if (listStatus === "wishlist-match") {
        scanner.markWishlistMatch(bookDetails.title);
      } else if (listStatus === "owned-match") {
        scanner.markOwnedMatch(bookDetails.title);
      } else {
        scanner.markSuccess(bookDetails.title);
      }

    } catch (err) {
      console.error(`Failed to scan/add book ${isbn}:`, err);
      // Mark failure in history and HUD overlay
      const itemIndex = sessionScannedBooks.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        sessionScannedBooks[itemIndex].title = "Failed to add to library";
        sessionScannedBooks[itemIndex].author = err.message || "Network error";
        sessionScannedBooks[itemIndex].status = "failed";
      }
      renderSessionList(listEl, badgeEl);
      scanner.markFailure(err.message || "Network error");
    }
  });
}

function renderSessionList(listEl, badgeEl) {
  if (sessionScannedBooks.length === 0) {
    listEl.innerHTML = "";
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No books scanned yet in this session. Barcodes will appear here as soon as you scan them.";
    listEl.appendChild(emptyState);
    badgeEl.style.display = "none";
    return;
  }

  badgeEl.textContent = sessionScannedBooks.length;
  badgeEl.style.display = "inline-block";

  listEl.innerHTML = "";

  for (const item of sessionScannedBooks) {
    const itemEl = document.createElement("div");
    itemEl.className = `scanned-book-item ${item.status}`;

    // Cover
    if (item.coverUrl) {
      const img = document.createElement("img");
      img.className = "cover-thumb";
      img.alt = "Cover Image";
      img.src = item.coverUrl;
      itemEl.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "cover-placeholder";
      
      placeholder.innerHTML = `
        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      `;
      itemEl.appendChild(placeholder);
    }

    // Book Info
    const infoEl = document.createElement("div");
    infoEl.className = "book-info";

    const titleEl = document.createElement("div");
    titleEl.className = "book-title";
    titleEl.textContent = item.title;

    const authorEl = document.createElement("div");
    authorEl.className = "book-author";
    authorEl.textContent = item.author;

    const isbnEl = document.createElement("div");
    isbnEl.className = "book-isbn";
    isbnEl.textContent = item.isbn;

    infoEl.appendChild(titleEl);
    infoEl.appendChild(authorEl);
    infoEl.appendChild(isbnEl);
    itemEl.appendChild(infoEl);

    // Status Text
    let statusText = "Adding...";
    if (item.status === "success") statusText = "Saved";
    if (item.status === "wishlist-match") statusText = "Wishlist Match! ✨";
    if (item.status === "owned-match") statusText = "Already Owned 📚";
    if (item.status === "failed") statusText = "Failed";

    const statusEl = document.createElement("div");
    statusEl.className = "scan-status";
    statusEl.textContent = statusText;
    itemEl.appendChild(statusEl);

    // Dynamic actions for managing scanned books
    if (item.userBookId && item.status !== "loading" && item.status !== "failed") {
      const actionsEl = document.createElement("div");
      actionsEl.className = "scan-actions";

      // If wishlisted (success or wishlist-match), show "Mark Owned"
      if (item.status === "success" || item.status === "wishlist-match") {
        const ownBtn = document.createElement("button");
        ownBtn.className = "btn-scan-action btn-own";
        ownBtn.textContent = "Mark Owned";
        ownBtn.addEventListener("click", async () => {
          try {
            await request("PATCH", "/user/books", {
              user_book_id: item.userBookId,
              status: "owned",
            });
            item.status = "owned-match";
            renderSessionList(listEl, badgeEl);
          } catch (err) {
            alert(`Failed to update status: ${err.message}`);
          }
        });
        actionsEl.appendChild(ownBtn);
      }

      // Show "Remove" button
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn-scan-action btn-remove danger";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        try {
          await request("DELETE", "/user/books", { user_book_id: item.userBookId });
          sessionScannedBooks = sessionScannedBooks.filter(x => x.id !== item.id);
          renderSessionList(listEl, badgeEl);
        } catch (err) {
          alert(`Failed to delete book: ${err.message}`);
        }
      });
      actionsEl.appendChild(removeBtn);

      itemEl.appendChild(actionsEl);
    }

    listEl.appendChild(itemEl);
  }
}

