import { login, register } from "../auth.js";

class AuthForm extends HTMLElement {
  connectedCallback() {
    const mode = this.getAttribute("mode") || "login";
    const isRegister = mode === "register";

    // eslint-disable-next-line no-unsanitized/property
    this.innerHTML = `
      <div class="auth-card">
        <h2>${isRegister ? "Create a Book Buddy account" : "Sign in to Book Buddy"}</h2>
        <p class="auth-subtitle">Authentication is securely handled by Auth0.</p>
        <button id="auth-submit-btn" class="auth-btn"></button>
        <div class="auth-switch-container"></div>
      </div>
    `;

    const submitBtn = this.querySelector('#auth-submit-btn');
    submitBtn.textContent = isRegister ? "Sign Up via Auth0" : "Sign In via Auth0";

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

customElements.define("auth-form", AuthForm);
export { AuthForm };
