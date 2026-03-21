import { request } from "../api.js";
import "./book-card.js";

class BookList extends HTMLElement {
  async connectedCallback() {
    this.innerHTML = `<p class="loading">Loading books…</p>`;
    await this.loadBooks();

    this.addEventListener("book-status-change", async (e) => {
      const { userBookId, status } = e.detail;
      try {
        await request("PATCH", "/user/books", {
          user_book_id: userBookId,
          status,
        });
        await this.loadBooks();
      } catch (err) {
        alert(`Failed to update status: ${err.message}`);
      }
    });

    this.addEventListener("book-delete", async (e) => {
      const { userBookId } = e.detail;
      try {
        await request("DELETE", "/user/books", { user_book_id: userBookId });
        await this.loadBooks();
      } catch (err) {
        alert(`Failed to delete book: ${err.message}`);
      }
    });
  }

  async loadBooks() {
    try {
      const data = await request("GET", "/user/books");
      const books = data.books || [];
      if (books.length === 0) {
        this.innerHTML = `<p>No books yet. <a href="#/scanner">Scan one!</a></p>`;
        return;
      }
      const grid = document.createElement("div");
      grid.className = "book-grid";
      for (const b of books) {
        const card = document.createElement("book-card");
        grid.appendChild(card);
        card.book = {
          id: b.id,
          title: b.title,
          author: b.author,
          isbn: b.isbn,
          status: b.status,
        };
      }
      this.innerHTML = "";
      this.appendChild(grid);
    } catch (err) {
      this.innerHTML = `<p class="error">Failed to load books: ${err.message}</p>`;
    }
  }
}

customElements.define("book-list", BookList);
