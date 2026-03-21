import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock localStorage before auth.js is imported.
// Functions in auth.js access localStorage lazily (inside function bodies),
// so setting the global here is sufficient.
const store = new Map();
global.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { getToken, setToken, clearToken, isLoggedIn } = await import("../auth.js");

describe("auth", () => {
  beforeEach(() => store.clear());

  test("getToken returns null when nothing is stored", () => {
    assert.equal(getToken(), null);
  });

  test("setToken / getToken round-trip", () => {
    setToken("abc123");
    assert.equal(getToken(), "abc123");
  });

  test("clearToken removes the stored token", () => {
    setToken("abc123");
    clearToken();
    assert.equal(getToken(), null);
  });

  test("isLoggedIn is false when no token", () => {
    assert.equal(isLoggedIn(), false);
  });

  test("isLoggedIn is true when a token is stored", () => {
    setToken("abc123");
    assert.equal(isLoggedIn(), true);
  });

  test("isLoggedIn is false after clearToken", () => {
    setToken("abc123");
    clearToken();
    assert.equal(isLoggedIn(), false);
  });
});
