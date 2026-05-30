class BookCard extends HTMLElement {
  set book(data) {
    this._book = data;
    this.render();
  }

  get book() {
    return this._book;
  }

  render() {
    const b = this._book;
    if (!b) return;

    const hasMetadata = b.title && b.title !== "Unknown" && b.title.trim() !== "";
    const titleText = hasMetadata ? b.title : "[Metadata Lookup Failed]";
    const authorText = hasMetadata ? b.author : "[Unknown Author]";
    const cardClass = hasMetadata ? "book-card" : "book-card lookup-failed";

    this.className = cardClass;

    let coverHtml = `
      <div class="cover-placeholder">
        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      </div>
    `;
    if (b.cover_url) {
      coverHtml = `<img src="${escHtml(b.cover_url)}" class="cover-thumb" alt="Cover Image">`;
    }

    this.innerHTML = `
      <div class="book-card-main">
        ${coverHtml}
        <div class="book-details">
          <div class="title">${escHtml(titleText)}</div>
          <div class="author">${escHtml(authorText)}</div>
          ${!hasMetadata ? `<div class="lookup-badge">Metadata lookup failed</div>` : ""}
          <div class="isbn">${escHtml(b.isbn)}</div>
          <div class="status ${escHtml(b.status)}">${escHtml(b.status)}</div>
        </div>
      </div>
      <div class="actions">
        ${b.status !== "owned" ? `<button data-action="owned">Mark Owned</button>` : ""}
        ${b.status !== "wishlisted" ? `<button data-action="wishlisted">Wishlist</button>` : ""}
        <button data-action="delete" class="danger">Remove</button>
      </div>
    `;

    this.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "delete") {
          this.dispatchEvent(new CustomEvent("book-delete", {
            bubbles: true,
            detail: { userBookId: b.id },
          }));
        } else {
          this.dispatchEvent(new CustomEvent("book-status-change", {
            bubbles: true,
            detail: { userBookId: b.id, status: action },
          }));
        }
      });
    });
  }
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

customElements.define("book-card", BookCard);
