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

    this.className = "book-card";
    this.innerHTML = `
      <div class="title">${escHtml(b.title)}</div>
      <div class="author">${escHtml(b.author)}</div>
      <div class="isbn">${escHtml(b.isbn)}</div>
      <div class="status">${escHtml(b.status)}</div>
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
