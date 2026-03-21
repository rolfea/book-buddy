import { request } from "../api.js";
import "../components/isbn-scanner.js";

export function render(container) {
  container.innerHTML = `<h1>Scan a Book</h1>`;
  const scanner = document.createElement("isbn-scanner");
  container.appendChild(scanner);

  scanner.addEventListener("isbn-detected", async (e) => {
    const isbn = e.detail.isbn;
    try {
      await request("POST", "/user/books", {
        books: [{ isbn, title: "Unknown", author: "Unknown", status: "wishlisted" }],
      });
      window.location.hash = "#/books";
    } catch (err) {
      alert(`Failed to add book: ${err.message}`);
    }
  });
}
