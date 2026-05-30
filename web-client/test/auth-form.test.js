import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// Set up DOM globals before importing the component.
const win = new Window({ url: "http://localhost" });
global.window = win;
global.document = win.document;
global.HTMLElement = win.HTMLElement;
global.customElements = win.customElements;
global.CustomEvent = win.CustomEvent;
global.location = win.location;

// Mock fetch
let mockResponse = { ok: true, status: 200, body: {} };
global.fetch = async () => {
  const { ok, status, body } = mockResponse;
  return { ok, status, json: async () => body };
};

await import("../components/auth-form.js");

function mountForm(mode) {
  const formEl = win.document.createElement("auth-form");
  if (mode) {
    formEl.setAttribute("mode", mode);
  }
  win.document.body.appendChild(formEl);
  return formEl;
}

describe("auth-form", () => {
  beforeEach(() => {
    win.document.body.innerHTML = "";
    mockResponse = { ok: true, status: 200, body: {} };
    win.location.hash = "";
  });

  test("renders login form by default", () => {
    const formEl = mountForm();
    const button = formEl.querySelector('button[type="submit"]');
    assert.equal(button.textContent, "Login");
    
    const switchContainer = formEl.querySelector(".auth-switch-container");
    const link = switchContainer.querySelector("a");
    assert.equal(link.getAttribute("href"), "#/register");
    assert.equal(link.textContent, "Create an account");
  });

  test("renders register form when mode attribute is register", () => {
    const formEl = mountForm("register");
    const button = formEl.querySelector('button[type="submit"]');
    assert.equal(button.textContent, "Register");
    
    const switchContainer = formEl.querySelector(".auth-switch-container");
    const p = switchContainer.querySelector("p");
    assert.ok(p.textContent.includes("Already have an account?"));
    const link = p.querySelector("a");
    assert.equal(link.getAttribute("href"), "#/login");
    assert.equal(link.textContent, "Sign in");
  });

  test("submits login form and updates hash on success", async () => {
    const formEl = mountForm("login");
    const form = formEl.querySelector("form");
    
    // Fill in email and password
    form.querySelector('input[name="email"]').value = "test@example.com";
    form.querySelector('input[name="password"]').value = "password123";

    const apiCalls = [];
    global.fetch = async (url, options) => {
      apiCalls.push({ url, options });
      if (url.includes("/auth/login")) {
        return { ok: true, status: 200, json: async () => ({ token: "fake-jwt" }) };
      }
      if (url.includes("/auth/me")) {
        return { ok: true, status: 200, json: async () => ({ id: "1", email: "test@example.com" }) };
      }
      return { ok: false, status: 404 };
    };

    // Trigger form submit
    const submitEvent = new win.Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    // Wait a brief tick for async handler to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(apiCalls.some(call => call.url.includes("/auth/login")));
    assert.equal(win.location.hash, "#/books");
  });

  test("submits register form and updates hash on success", async () => {
    const formEl = mountForm("register");
    const form = formEl.querySelector("form");
    
    form.querySelector('input[name="email"]').value = "new@example.com";
    form.querySelector('input[name="password"]').value = "password123";

    const apiCalls = [];
    global.fetch = async (url, options) => {
      apiCalls.push({ url, options });
      if (url.includes("/auth/register")) {
        return { ok: true, status: 200, json: async () => ({ token: "fake-jwt" }) };
      }
      if (url.includes("/auth/me")) {
        return { ok: true, status: 200, json: async () => ({ id: "2", email: "new@example.com" }) };
      }
      return { ok: false, status: 404 };
    };

    const submitEvent = new win.Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(apiCalls.some(call => call.url.includes("/auth/register")));
    assert.equal(win.location.hash, "#/books");
  });

  test("displays error message on form submission failure", async () => {
    const formEl = mountForm("login");
    const form = formEl.querySelector("form");
    const errorEl = form.querySelector(".error");
    
    form.querySelector('input[name="email"]').value = "bad@example.com";
    form.querySelector('input[name="password"]').value = "wrong";

    global.fetch = async (url) => {
      if (url.includes("/auth/login")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: "Invalid credentials" }),
        };
      }
      return { ok: false, status: 404 };
    };

    assert.ok(errorEl.hidden);

    const submitEvent = new win.Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(errorEl.hidden, false);
    assert.equal(errorEl.textContent, "Invalid credentials");
  });
});
