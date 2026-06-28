import { login, register, checkSession } from "../auth.js";
import { request } from "../api.js";

class AuthForm extends HTMLElement {
  connectedCallback() {
    const mode = this.getAttribute("mode") || "login";
    const isRegister = mode === "register";
    const isTestMode = typeof window !== "undefined" && window.IS_TEST;

    if (isTestMode) {
      // eslint-disable-next-line no-unsanitized/property
      this.innerHTML = `
        <div class="auth-card">
          <h2>${isRegister ? "Create a Book Buddy account" : "Sign in to Book Buddy"}</h2>
          <form id="auth-test-form" style="width: 100%; display: flex; flex-direction: column; gap: 0.75rem;">
            <input type="email" name="email" placeholder="Email" required style="padding: 0.6rem 0.8rem; border: 1px solid var(--border-stone); border-radius: 4px; font-size: 0.95rem; width: 100%;" />
            <input type="password" name="password" placeholder="Password" required style="padding: 0.6rem 0.8rem; border: 1px solid var(--border-stone); border-radius: 4px; font-size: 0.95rem; width: 100%;" />
            <button type="submit" id="auth-submit-btn" class="auth-btn"></button>
            <p class="error" style="color: var(--color-danger); font-size: 0.85rem; margin-top: 0.25rem; text-align: left;" hidden></p>
          </form>
          <div class="auth-switch-container" style="width: 100%;"></div>
        </div>
      `;
    } else {
      // eslint-disable-next-line no-unsanitized/property
      this.innerHTML = `
        <div class="auth-card">
          <h2>${isRegister ? "Create a Book Buddy account" : "Sign in to Book Buddy"}</h2>
          <p class="auth-subtitle">Authentication is securely handled by Auth0.</p>
          <button id="auth-submit-btn" class="auth-btn"></button>
          <div class="auth-switch-container"></div>
        </div>
      `;
    }

    const submitBtn = this.querySelector('#auth-submit-btn');
    submitBtn.textContent = isTestMode
      ? (isRegister ? "Register" : "Login")
      : (isRegister ? "Sign Up via Auth0" : "Sign In via Auth0");

    const switchContainer = this.querySelector(".auth-switch-container");
    if (isRegister) {
      const p = document.createElement("p");
      p.className = "auth-switch";
      p.textContent = "Already have an account? ";
      
      const link = document.createElement("a");
      link.href = "#/login";
      link.textContent = "Sign in";
      
      p.appendChild(link);
      switchContainer.appendChild(p);
    } else {
      const link = document.createElement("a");
      link.href = "#/register";
      link.className = "auth-switch-cta";
      link.textContent = "Create an account";
      
      switchContainer.appendChild(link);
    }

    if (isTestMode) {
      const form = this.querySelector("#auth-test-form");
      const errorEl = form.querySelector(".error");
      
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorEl.hidden = true;
        
        const email = form.email.value.trim();
        const password = form.password.value;
        
        try {
          const endpoint = isRegister ? "/auth/register" : "/auth/login";
          // request helper maps prefix /api automatically
          await request("POST", endpoint, { email, password });
          await checkSession();
          window.location.hash = "#/books";
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
        }
      });
    } else {
      submitBtn.addEventListener("click", async () => {
        try {
          if (isRegister) {
            await register();
          } else {
            await login();
          }
        } catch (err) {
          console.error(err);
        }
      });
    }
  }
}

customElements.define("auth-form", AuthForm);
export { AuthForm };
