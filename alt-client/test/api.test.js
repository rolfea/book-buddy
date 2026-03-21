import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// --- mock localStorage ---
const store = new Map();
global.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

// --- mock fetch ---
let lastRequest = null;
let mockResponse = { ok: true, status: 200, body: {} };

global.fetch = async (url, opts) => {
  lastRequest = { url, method: opts.method, headers: opts.headers, body: opts.body };
  const { ok, status, body } = mockResponse;
  return { ok, status, json: async () => body };
};

const { request } = await import("../api.js");

describe("api.request", () => {
  beforeEach(() => {
    store.clear();
    lastRequest = null;
    mockResponse = { ok: true, status: 200, body: {} };
  });

  test("sends correct method and path", async () => {
    await request("GET", "/user/books");
    assert.equal(lastRequest.url, "/user/books");
    assert.equal(lastRequest.method, "GET");
  });

  test("always sets Content-Type: application/json", async () => {
    await request("GET", "/user/books");
    assert.equal(lastRequest.headers["Content-Type"], "application/json");
  });

  test("omits Authorization header when no token is stored", async () => {
    await request("GET", "/user/books");
    assert.equal(lastRequest.headers["Authorization"], undefined);
  });

  test("injects Bearer token when one is stored", async () => {
    store.set("book_buddy_token", "mytoken");
    await request("GET", "/user/books");
    assert.equal(lastRequest.headers["Authorization"], "Bearer mytoken");
  });

  test("serializes body as JSON", async () => {
    await request("POST", "/auth/login", { email: "a@b.com", password: "pw" });
    assert.equal(lastRequest.body, JSON.stringify({ email: "a@b.com", password: "pw" }));
  });

  test("does not include a body for bodyless requests", async () => {
    await request("GET", "/user/books");
    assert.equal(lastRequest.body, undefined);
  });

  test("returns parsed JSON on success", async () => {
    mockResponse.body = { token: "xyz" };
    const result = await request("POST", "/auth/login", {});
    assert.deepEqual(result, { token: "xyz" });
  });

  test("throws using the error field from the response body", async () => {
    mockResponse = { ok: false, status: 401, body: { error: "invalid credentials" } };
    await assert.rejects(() => request("POST", "/auth/login", {}), {
      message: "invalid credentials",
    });
  });

  test("throws HTTP status fallback when response body has no error field", async () => {
    mockResponse = { ok: false, status: 500, body: {} };
    await assert.rejects(() => request("POST", "/auth/login", {}), {
      message: "HTTP 500",
    });
  });

  test("returns null for 204 responses without calling json()", async () => {
    let jsonCalled = false;
    global.fetch = async () => ({
      ok: true,
      status: 204,
      json: async () => { jsonCalled = true; return null; },
    });
    const result = await request("DELETE", "/user/books", { user_book_id: "ub-1" });
    assert.equal(result, null);
    assert.equal(jsonCalled, false);
  });
});
