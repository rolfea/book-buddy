import { login, register } from "../auth.js";

class AuthForm extends HTMLElement {
  connectedCallback() {
    const mode = this.getAttribute("mode") || "login";
    const isRegister = mode === "register";

    this.innerHTML = `
      <form>
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit"></button>
        <p class="error" hidden></p>
      </form>
      <div class="auth-switch-container"></div>
    `;

    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.textContent = isRegister ? "Register" : "Login";

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

    this.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const errorEl = form.querySelector(".error");
      errorEl.hidden = true;

      const email = form.email.value.trim();
      const password = form.password.value;

      try {
        if (isRegister) {
          await register(email, password);
        } else {
          await login(email, password);
        }
        location.hash = "#/books";
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });
  }
}

customElements.define("auth-form", AuthForm);

