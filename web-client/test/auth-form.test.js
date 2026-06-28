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

// Mock window.crypto
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
win.auth0 = {
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
        win.location.assign(url);
      },
      logout: async (options) => {
        const domain = config.domain;
        const clientId = config.clientId;
        const returnTo = options?.logoutParams?.returnTo || "";
        
        const url = `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(returnTo)}`;
        win.location.assign(url);
      }
    };
  }
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
    win.location.hash = "";
  });

  test("renders login form by default", () => {
    const formEl = mountForm();
    const button = formEl.querySelector('#auth-submit-btn');
    assert.equal(button.textContent, "Sign In via Auth0");
    
    const switchContainer = formEl.querySelector(".auth-switch-container");
    const link = switchContainer.querySelector("a");
    assert.equal(link.getAttribute("href"), "#/register");
    assert.equal(link.textContent, "Create an account");
  });

  test("renders register form when mode attribute is register", () => {
    const formEl = mountForm("register");
    const button = formEl.querySelector('#auth-submit-btn');
    assert.equal(button.textContent, "Sign Up via Auth0");
    
    const switchContainer = formEl.querySelector(".auth-switch-container");
    const p = switchContainer.querySelector("p");
    assert.ok(p.textContent.includes("Already have an account?"));
    const link = p.querySelector("a");
    assert.equal(link.getAttribute("href"), "#/login");
    assert.equal(link.textContent, "Sign in");
  });

  test("clicking Auth0 button triggers login redirect", async () => {
    const formEl = mountForm("login");
    const button = formEl.querySelector('#auth-submit-btn');

    let redirected = false;
    win.location.assign = (url) => {
      if (url.includes("/authorize")) {
        redirected = true;
      }
    };

    button.click();

    // Wait a brief tick for async handler
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(redirected);
  });
});
