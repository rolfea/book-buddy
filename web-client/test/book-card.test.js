import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// Set up DOM globals before importing the component.
// The component calls customElements.define() at module evaluation time,
// so globals must be in place before the dynamic import below.
const win = new Window({ url: "http://localhost" });
global.window = win;
global.document = win.document;
global.HTMLElement = win.HTMLElement;
global.customElements = win.customElements;
global.CustomEvent = win.CustomEvent;

await import("../components/book-card.js");

const makeBook = (overrides = {}) => ({
  id: "ub-1",
  title: "The Pragmatic Programmer",
  author: "Andy Hunt",
  isbn: "9780135957059",
  status: "wishlisted",
  ...overrides,
});

function mountCard(book) {
  const card = win.document.createElement("book-card");
  win.document.body.appendChild(card);
  card.book = book;
  return card;
}

describe("book-card", () => {
  beforeEach(() => {
    win.document.body.innerHTML = "";
  });

  test("renders title, author, isbn, and status", () => {
    const card = mountCard(makeBook());
    assert.ok(card.innerHTML.includes("The Pragmatic Programmer"));
    assert.ok(card.innerHTML.includes("Andy Hunt"));
    assert.ok(card.innerHTML.includes("9780135957059"));
    assert.ok(card.innerHTML.includes("wishlisted"));
  });

  test("emits book-status-change with correct detail when 'Mark Owned' is clicked", () => {
    const card = mountCard(makeBook({ status: "wishlisted" }));
    let detail = null;
    card.addEventListener("book-status-change", (e) => { detail = e.detail; });

    card.querySelector('[data-action="owned"]').click();
    assert.deepEqual(detail, { userBookId: "ub-1", status: "owned" });
  });

  test("emits book-status-change with 'wishlisted' when 'Wishlist' is clicked", () => {
    const card = mountCard(makeBook({ status: "owned" }));
    let detail = null;
    card.addEventListener("book-status-change", (e) => { detail = e.detail; });

    card.querySelector('[data-action="wishlisted"]').click();
    assert.deepEqual(detail, { userBookId: "ub-1", status: "wishlisted" });
  });

  test("emits book-delete with correct detail when 'Remove' is clicked", () => {
    const card = mountCard(makeBook());
    let detail = null;
    card.addEventListener("book-delete", (e) => { detail = e.detail; });

    card.querySelector('[data-action="delete"]').click();
    assert.deepEqual(detail, { userBookId: "ub-1" });
  });

  test("hides 'Mark Owned' button when book is already owned", () => {
    const card = mountCard(makeBook({ status: "owned" }));
    assert.equal(card.querySelector('[data-action="owned"]'), null);
  });

  test("hides 'Wishlist' button when book is already wishlisted", () => {
    const card = mountCard(makeBook({ status: "wishlisted" }));
    assert.equal(card.querySelector('[data-action="wishlisted"]'), null);
  });

  test("escapes HTML in title to prevent XSS", () => {
    const card = mountCard(makeBook({ title: "<script>alert(1)</script>" }));
    assert.ok(!card.innerHTML.includes("<script>"));
    assert.ok(card.innerHTML.includes("&lt;script&gt;"));
  });
});
