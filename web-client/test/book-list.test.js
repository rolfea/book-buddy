import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// --- DOM globals ---
const win = new Window({ url: "http://localhost" });
global.window = win;
global.document = win.document;
global.HTMLElement = win.HTMLElement;
global.customElements = win.customElements;
global.CustomEvent = win.CustomEvent;
global.alert = () => {};  // book-list uses alert() for status/delete errors

// --- mock localStorage (api.js reads the token here) ---
const store = new Map();
global.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
store.set("book_buddy_token", "test-token");  // stay "logged in" for all tests

// --- mock fetch (api.js calls this) ---
// fetchHandler is replaced per-test; set a safe default so stray calls don't throw.
let fetchHandler = async () => ({
  ok: true, status: 200, json: async () => ({ books: [] }),
});
global.fetch = (url, opts) => fetchHandler(url, opts);

// Import components AFTER globals are set.
// book-list.js transitively imports book-card.js and api.js.
await import("../components/book-list.js");

// --- helpers ---
const sampleBooks = [
  { id: "ub-1", title: "Book One", author: "Author A", isbn: "1111111111111", status: "owned" },
  { id: "ub-2", title: "Book Two", author: "Author B", isbn: "2222222222222", status: "wishlisted" },
];

function mockOk(body, status = 200) {
  fetchHandler = async () => ({ ok: true, status, json: async () => body });
}

function mockError(errorMsg, status = 500) {
  fetchHandler = async () => ({
    ok: false, status, json: async () => ({ error: errorMsg }),
  });
}

function mount() {
  const el = win.document.createElement("book-list");
  win.document.body.appendChild(el);
  return el;
}

// Wait one event-loop turn so async connectedCallback can settle.
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe("book-list", () => {
  beforeEach(() => {
    win.document.body.innerHTML = "";
  });

  test("renders one book-card per book returned by the API", async () => {
    mockOk({ books: sampleBooks });
    const list = mount();
    await tick();

    const cards = list.querySelectorAll("book-card");
    assert.equal(cards.length, 2);
  });

  test("shows empty-state message when the API returns no books", async () => {
    mockOk({ books: [] });
    const list = mount();
    await tick();

    assert.ok(list.innerHTML.includes("No books yet"));
  });

  test("shows error message when the initial fetch fails", async () => {
    mockError("internal error");
    const list = mount();
    await tick();

    assert.ok(list.innerHTML.includes("Failed to load books"));
  });

  test("sends PATCH /user/books on book-status-change event", async () => {
    mockOk({ books: sampleBooks });
    const list = mount();
    await tick();

    let patchCall = null;
    fetchHandler = async (url, opts) => {
      patchCall = { url, method: opts.method, body: JSON.parse(opts.body) };
      return { ok: true, status: 200, json: async () => ({ books: sampleBooks }) };
    };

    list.dispatchEvent(
      new CustomEvent("book-status-change", {
        bubbles: true,
        detail: { userBookId: "ub-1", status: "owned" },
      })
    );
    await tick();

    assert.equal(patchCall.url, "/user/books");
    assert.equal(patchCall.method, "PATCH");
    assert.deepEqual(patchCall.body, { user_book_id: "ub-1", status: "owned" });
  });

  test("sends DELETE /user/books on book-delete event", async () => {
    mockOk({ books: sampleBooks });
    const list = mount();
    await tick();

    const calls = [];
    fetchHandler = async (url, opts) => {
      calls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
      // First call is DELETE (204); second call is the follow-up GET to reload the list.
      if (calls.length === 1) {
        return { ok: true, status: 204, json: async () => null };
      }
      return { ok: true, status: 200, json: async () => ({ books: [] }) };
    };

    list.dispatchEvent(
      new CustomEvent("book-delete", {
        bubbles: true,
        detail: { userBookId: "ub-2" },
      })
    );
    await tick();

    const deleteCall = calls[0];
    assert.equal(deleteCall.url, "/user/books");
    assert.equal(deleteCall.method, "DELETE");
    assert.deepEqual(deleteCall.body, { user_book_id: "ub-2" });
  });

  test("reloads the book list after a successful status change", async () => {
    mockOk({ books: sampleBooks });
    const list = mount();
    await tick();

    let getCallCount = 0;
    fetchHandler = async (url, opts) => {
      if (opts.method === "GET") getCallCount++;
      return { ok: true, status: 200, json: async () => ({ books: sampleBooks }) };
    };

    list.dispatchEvent(
      new CustomEvent("book-status-change", {
        bubbles: true,
        detail: { userBookId: "ub-1", status: "wishlisted" },
      })
    );
    await tick();

    assert.equal(getCallCount, 1);
  });
});
