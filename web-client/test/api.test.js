import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// --- mock fetch ---
let lastRequest = null;
let mockResponse = { ok: true, status: 200, body: {} };

global.fetch = async (url, opts) => {
  lastRequest = { url, method: opts.method, headers: opts.headers, body: opts.body, credentials: opts.credentials };
  const { ok, status, body } = mockResponse;
  return { ok, status, json: async () => body };
};

const { request, parseNullString } = await import("../api.js");

describe("parseNullString", () => {
  test("returns empty string for null, undefined, or empty values", () => {
    assert.equal(parseNullString(null), "");
    assert.equal(parseNullString(undefined), "");
    assert.equal(parseNullString(""), "");
  });

  test("extracts value from a valid sql.NullString shape object", () => {
    assert.equal(parseNullString({ String: "https://example.com/a.jpg", Valid: true }), "https://example.com/a.jpg");
  });

  test("returns empty string from an invalid sql.NullString shape object", () => {
    assert.equal(parseNullString({ String: "", Valid: false }), "");
  });

  test("returns the string directly if input is already a raw string", () => {
    assert.equal(parseNullString("https://example.com/b.jpg"), "https://example.com/b.jpg");
  });
});

describe("api.request", () => {
  beforeEach(() => {
    lastRequest = null;
    mockResponse = { ok: true, status: 200, body: {} };
  });

  test("sends correct method and path with /api prefix", async () => {
    await request("GET", "/user/books");
    assert.equal(lastRequest.url, "/api/user/books");
    assert.equal(lastRequest.method, "GET");
  });

  test("always sets Content-Type: application/json and CSRF header", async () => {
    await request("GET", "/user/books");
    assert.equal(lastRequest.headers["Content-Type"], "application/json");
    assert.equal(lastRequest.headers["X-BookBuddy-Request"], "true");
  });

  test("includes credentials: 'include'", async () => {
    await request("GET", "/user/books");
    assert.equal(lastRequest.credentials, "include");
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
