import { request } from "../api.js";
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
      await request("POST", "/user/books", {
        books: [{ isbn, status: "wishlisted" }],
      });

      // 3. Fetch full book metadata to display locally
      let bookDetails = { title: "Unknown Title", author: "Unknown Author", coverUrl: null };
      try {
        const book = await request("GET", `/api/books/lookup?isbn=${isbn}`);
        if (book) {
          bookDetails = {
            title: book.title || "Unknown Title",
            author: book.author || "Unknown Author",
            coverUrl: book.cover_url || null,
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
      if (itemIndex !== -1) {
        sessionScannedBooks[itemIndex] = {
          ...sessionScannedBooks[itemIndex],
          ...bookDetails,
          status: "success",
        };
      }
      renderSessionList(listEl, badgeEl);
      scanner.markSuccess(bookDetails.title);

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
    listEl.innerHTML = `<div class="empty-state">No books scanned yet in this session. Barcodes will appear here as soon as you scan them.</div>`;
    badgeEl.style.display = "none";
    return;
  }

  badgeEl.textContent = sessionScannedBooks.length;
  badgeEl.style.display = "inline-block";

  listEl.innerHTML = sessionScannedBooks.map(item => {
    let coverHtml = `<div class="cover-placeholder">ISBN</div>`;
    if (item.coverUrl) {
      coverHtml = `<img src="${escHtml(item.coverUrl)}" class="cover-thumb" alt="Cover Image">`;
    }

    let statusText = "Adding...";
    if (item.status === "success") statusText = "Saved";
    if (item.status === "failed") statusText = "Failed";

    return `
      <div class="scanned-book-item ${item.status}">
        ${coverHtml}
        <div class="book-info">
          <div class="book-title">${escHtml(item.title)}</div>
          <div class="book-author">${escHtml(item.author)}</div>
          <div class="book-isbn">${escHtml(item.isbn)}</div>
        </div>
        <div class="scan-status">${statusText}</div>
      </div>
    `;
  }).join("");
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
