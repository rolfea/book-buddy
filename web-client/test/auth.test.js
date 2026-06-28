import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock fetch
let mockResponse = { ok: true, status: 200, body: {} };
global.fetch = async () => {
  const { ok, status, body } = mockResponse;
  return { ok, status, json: async () => body };
};

// Set up minimal location mock
global.window = {
  location: {
    origin: "http://localhost:8081",
    assign: () => {}
  }
};
global.location = global.window.location;

// Mock crypto
global.window.crypto = {
  getRandomValues: (array) => {
    for (let i = 0; i < array.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      array[i] = Math.floor(Math.random() * 0xffffffff);
    }
    return array;
  },
  subtle: {
    digest: async (_algo, _data) => new Uint8Array([1, 2, 3])
  }
};

// Mock sessionStorage
global.sessionStorage = {
  setItem: () => {},
  getItem: () => "mock",
  removeItem: () => {}
};

// Mock window.auth0
global.window.auth0 = {
  createAuth0Client: async (config) => {
    return {
      loginWithRedirect: async (options) => {
        const domain = config.domain;
        const clientId = config.clientId;
        const redirectUri = options?.authorizationParams?.redirect_uri || config.authorizationParams?.redirect_uri || "";
        const screenHint = options?.authorizationParams?.screen_hint || "";
        
        let url = `https://${domain}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        if (screenHint) {
          url += `&screen_hint=${screenHint}`;
        }
        global.window.location.assign(url);
      },
      logout: async (options) => {
        const domain = config.domain;
        const clientId = config.clientId;
        const returnTo = options?.logoutParams?.returnTo || "";
        
        const url = `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(returnTo)}`;
        global.window.location.assign(url);
      }
    };
  }
};

const { checkSession, isLoggedIn, getUser, login, logout } = await import("../auth.js");

describe("auth", () => {
  beforeEach(() => {
    mockResponse = { ok: true, status: 200, body: {} };
    global.window.location.assign = () => {};
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

  test("login triggers Auth0 redirection", async () => {
    let redirectedUrl = "";
    global.window.location.assign = (url) => {
      redirectedUrl = url;
    };

    await login();
    assert.ok(redirectedUrl.includes("/authorize"));
    assert.ok(redirectedUrl.includes("client_id=sxAckgOU1BtWidrVdkvIqptbK3srOa7a"));
    assert.ok(redirectedUrl.includes("response_type=code"));
  });

  test("logout clears session and redirects to Auth0 logout", async () => {
    // Manually set logged in state by successful checkSession
    mockResponse.body = { id: "1", email: "test@test.com" };
    await checkSession();
    assert.equal(isLoggedIn(), true);

    // Mock logout API call
    mockResponse = { ok: true, status: 204, body: null };

    let redirectedUrl = "";
    global.window.location.assign = (url) => {
      redirectedUrl = url;
    };

    await logout();
    assert.equal(isLoggedIn(), false);
    assert.equal(getUser(), null);
    assert.ok(redirectedUrl.includes("/v2/logout"));
    assert.ok(redirectedUrl.includes("client_id=sxAckgOU1BtWidrVdkvIqptbK3srOa7a"));
  });
});
