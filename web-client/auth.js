import { request } from "./api.js";

let currentUser = null;

// Helpers for PKCE
function dec2hex(dec) {
  return dec.toString(16).padStart(2, "0");
}

function generateRandomString(length = 43) {
  const array = new Uint32Array(length / 2);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    // Basic fallback for environments lacking crypto.getRandomValues (e.g. some test runners)
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 0xffffffff);
    }
  }
  return Array.from(array, dec2hex).join("").substring(0, length);
}

function base64url(bytes) {
  const binary = String.fromCharCode.apply(null, new Uint8Array(bytes));
  const base64 = typeof window !== "undefined" ? btoa(binary) : (typeof globalThis !== "undefined" && globalThis.Buffer ? globalThis.Buffer.from(binary, "binary").toString("base64") : "");
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return base64url(digest);
  }
  // Simple test fallback (just raw string in base64url)
  const base64 = typeof window !== "undefined" ? btoa(verifier) : (typeof globalThis !== "undefined" && globalThis.Buffer ? globalThis.Buffer.from(verifier).toString("base64") : "");
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function checkSession() {
  try {
    currentUser = await request("GET", "/auth/me");
    return currentUser;
  } catch {
    currentUser = null;
    return null;
  }
}

export function getUser() {
  return currentUser;
}

export function isLoggedIn() {
  return !!currentUser;
}

export async function redirectToLogin(screenHint = "") {
  const domain = (typeof window !== "undefined" ? window.AUTH0_DOMAIN : "") || "your-tenant.us.auth0.com";
  const clientId = (typeof window !== "undefined" ? window.AUTH0_CLIENT_ID : "") || "your-client-id";

  const state = generateRandomString(16);
  const codeVerifier = generateRandomString(43);

  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("auth_state", state);
    sessionStorage.setItem("auth_code_verifier", codeVerifier);
  }

  const challenge = await generateCodeChallenge(codeVerifier);

  const params = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: (typeof window !== "undefined" ? window.location.origin : "http://localhost:8081") + "/callback.html",
    scope: "openid profile email",
    state: state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  };

  if (screenHint) {
    params.screen_hint = screenHint;
  }

  const authUrl = `https://${domain}/authorize?` + new URLSearchParams(params).toString();
  if (typeof window !== "undefined" && window.location) {
    window.location.assign(authUrl);
  }
  return authUrl;
}

export async function login() {
  await redirectToLogin();
}

export async function register() {
  await redirectToLogin("signup");
}

export async function logout() {
  try {
    await request("POST", "/auth/logout");
  } catch (err) {
    console.error("failed local logout", err);
  }
  currentUser = null;

  const domain = (typeof window !== "undefined" ? window.AUTH0_DOMAIN : "") || "your-tenant.us.auth0.com";
  const clientId = (typeof window !== "undefined" ? window.AUTH0_CLIENT_ID : "") || "your-client-id";
  const returnTo = typeof window !== "undefined" ? window.location.origin : "http://localhost:8081";

  const logoutUrl = `https://${domain}/v2/logout?` + new URLSearchParams({
    client_id: clientId,
    returnTo: returnTo,
  }).toString();

  if (typeof window !== "undefined" && window.location) {
    window.location.assign(logoutUrl);
  }
}
