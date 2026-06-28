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

    let transactionKey = null;
    let savedState = sessionStorage.getItem("auth_state");
    let codeVerifier = sessionStorage.getItem("auth_code_verifier");

    // Search sessionStorage for Auth0 SDK transaction keys if not found in default keys
    if (!savedState || !codeVerifier) {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("a0.spajs.txs.")) {
          try {
            const tx = JSON.parse(sessionStorage.getItem(key));
            if (tx && tx.state === state) {
              savedState = tx.state;
              codeVerifier = tx.code_verifier;
              transactionKey = key;
              break;
            }
          } catch (e) {
            console.error("Failed to parse transaction from sessionStorage", e);
          }
        }
      }
    }

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
    if (transactionKey) {
      sessionStorage.removeItem(transactionKey);
    }

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
