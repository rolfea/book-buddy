import { request } from "./api.js";

let currentUser = null;
let auth0Client = null;

export async function getAuth0Client() {
  if (auth0Client) {
    return auth0Client;
  }
  const domain = typeof window !== "undefined" ? window.AUTH0_DOMAIN : "";
  const clientId = typeof window !== "undefined" ? window.AUTH0_CLIENT_ID : "";

  if (!domain || !clientId) {
    throw new Error("Auth0 configuration missing (AUTH0_DOMAIN or AUTH0_CLIENT_ID)");
  }

  if (typeof window !== "undefined" && window.auth0) {
    auth0Client = await window.auth0.createAuth0Client({
      domain,
      clientId,
      authorizationParams: {
        redirect_uri: window.location.origin + "/callback.html",
        scope: "openid profile email",
      }
    });
  }
  return auth0Client;
}

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
  const client = await getAuth0Client();
  const redirectUri = (typeof window !== "undefined" ? window.location.origin : "http://localhost:8081") + "/callback.html";

  if (client) {
    const options = {
      authorizationParams: {
        redirect_uri: redirectUri,
      }
    };
    if (screenHint) {
      options.authorizationParams.screen_hint = screenHint;
    }
    await client.loginWithRedirect(options);
    return;
  }

  // Fallback behavior if SDK is not available (e.g. static environments or unit tests)
  const domain = typeof window !== "undefined" ? window.AUTH0_DOMAIN : "";
  const clientId = typeof window !== "undefined" ? window.AUTH0_CLIENT_ID : "";

  if (!domain || !clientId) {
    throw new Error("Auth0 configuration missing (AUTH0_DOMAIN or AUTH0_CLIENT_ID)");
  }

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
    redirect_uri: redirectUri,
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

  const client = await getAuth0Client();
  if (client) {
    await client.logout({
      logoutParams: {
        returnTo: typeof window !== "undefined" ? window.location.origin : "http://localhost:8081",
      }
    });
    return;
  }

  const domain = typeof window !== "undefined" ? window.AUTH0_DOMAIN : "";
  const clientId = typeof window !== "undefined" ? window.AUTH0_CLIENT_ID : "";

  if (!domain || !clientId) {
    throw new Error("Auth0 configuration missing (AUTH0_DOMAIN or AUTH0_CLIENT_ID)");
  }
  const returnTo = typeof window !== "undefined" ? window.location.origin : "http://localhost:8081";

  const logoutUrl = `https://${domain}/v2/logout?` + new URLSearchParams({
    client_id: clientId,
    returnTo: returnTo,
  }).toString();

  if (typeof window !== "undefined" && window.location) {
    window.location.assign(logoutUrl);
  }
}
