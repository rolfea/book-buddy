import "../components/book-list.js";

export function render(container) {
  container.innerHTML = `<h1>My Books</h1>`;
  const list = document.createElement("book-list");
  container.appendChild(list);
}
