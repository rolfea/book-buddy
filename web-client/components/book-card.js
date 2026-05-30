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

    this.innerHTML = `
      <div class="book-card-main">
        <div class="cover-container"></div>
        <div class="book-details">
          <div class="title"></div>
          <div class="author"></div>
          <div class="lookup-badge" hidden>Metadata lookup failed</div>
          <div class="isbn"></div>
          <div class="status"></div>
        </div>
      </div>
      <div class="actions"></div>
    `;

    const coverContainer = this.querySelector(".cover-container");
    if (b.cover_url) {
      const img = document.createElement("img");
      img.className = "cover-thumb";
      img.alt = "Cover Image";
      img.src = b.cover_url;
      coverContainer.appendChild(img);
    } else {
      coverContainer.innerHTML = `
        <div class="cover-placeholder">
          <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </div>
      `;
    }

    this.querySelector(".title").textContent = titleText;
    this.querySelector(".author").textContent = authorText;
    
    const badge = this.querySelector(".lookup-badge");
    badge.hidden = hasMetadata;
    
    this.querySelector(".isbn").textContent = b.isbn;
    
    const statusEl = this.querySelector(".status");
    statusEl.className = `status ${b.status}`;
    statusEl.textContent = b.status;

    const actionsContainer = this.querySelector(".actions");
    if (b.status !== "owned") {
      const btn = document.createElement("button");
      btn.dataset.action = "owned";
      btn.textContent = "Mark Owned";
      actionsContainer.appendChild(btn);
    }
    if (b.status !== "wishlisted") {
      const btn = document.createElement("button");
      btn.dataset.action = "wishlisted";
      btn.textContent = "Wishlist";
      actionsContainer.appendChild(btn);
    }
    const deleteBtn = document.createElement("button");
    deleteBtn.dataset.action = "delete";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Remove";
    actionsContainer.appendChild(deleteBtn);

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

customElements.define("book-card", BookCard);

