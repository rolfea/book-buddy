import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock fetch
let mockResponse = { ok: true, status: 200, body: {} };
global.fetch = async (url, opts) => {
  const { ok, status, body } = mockResponse;
  return { ok, status, json: async () => body };
};

const { checkSession, isLoggedIn, getUser, login, logout } = await import("../auth.js");

describe("auth", () => {
  beforeEach(() => {
    mockResponse = { ok: true, status: 200, body: {} };
  });

  test("isLoggedIn returns false initially", () => {
    assert.equal(isLoggedIn(), false);
  });

  test("checkSession updates user and returns it on success", async () => {
    const user = { id: "1", email: "test@test.com" };
    mockResponse.body = user;
    
    const result = await checkSession();
    assert.deepEqual(result, user);
    assert.equal(isLoggedIn(), true);
    assert.deepEqual(getUser(), user);
  });

  test("checkSession clears user on failure", async () => {
    mockResponse = { ok: false, status: 401, body: { error: "unauthorized" } };
    
    const result = await checkSession();
    assert.equal(result, null);
    assert.equal(isLoggedIn(), false);
    assert.equal(getUser(), null);
  });

  test("login updates session", async () => {
    mockResponse.body = { token: "fake-token" };
    // Subsequent checkSession call in login()
    const user = { id: "1", email: "test@test.com" };
    
    let callCount = 0;
    global.fetch = async (url) => {
      callCount++;
      if (url.includes("/login")) return { ok: true, status: 200, json: async () => ({ token: "fake" }) };
      return { ok: true, status: 200, json: async () => user };
    };

    await login("test@test.com", "password");
    assert.equal(isLoggedIn(), true);
    assert.deepEqual(getUser(), user);
  });

  test("logout clears session", async () => {
    // Manually set logged in state by successful checkSession
    mockResponse.body = { id: "1", email: "test@test.com" };
    await checkSession();
    assert.equal(isLoggedIn(), true);

    // Mock logout response
    mockResponse = { ok: true, status: 204, body: null };
    // Mock location.hash change to avoid error
    global.location = { hash: "" };

    await logout();
    assert.equal(isLoggedIn(), false);
    assert.equal(getUser(), null);
    assert.equal(global.location.hash, "#/login");
  });
});
