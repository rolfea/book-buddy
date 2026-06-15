import { request } from "./api.js";

async function handleCallback() {
  const errorEl = document.getElementById("error-message");
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      throw new Error("Authorization code or state parameter missing");
    }

    const savedState = sessionStorage.getItem("auth_state");
    const codeVerifier = sessionStorage.getItem("auth_code_verifier");

    if (state !== savedState) {
      throw new Error("Invalid state parameter (potential CSRF attempt)");
    }

    if (!codeVerifier) {
      throw new Error("Code verifier missing from storage");
    }

    // Call Go backend BFF endpoint to exchange the code
    await request("POST", "/auth/callback", {
      code: code,
      code_verifier: codeVerifier
    });

    // Clean up
    sessionStorage.removeItem("auth_state");
    sessionStorage.removeItem("auth_code_verifier");

    // Redirect to main books page
    window.location.replace("/#/books");
  } catch (err) {
    console.error("Authentication failed", err);
    if (errorEl) {
      errorEl.textContent = `Login failed: ${err.message}`;
      errorEl.hidden = false;
    }
  }
}

window.addEventListener("DOMContentLoaded", handleCallback);
