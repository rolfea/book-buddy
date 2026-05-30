import { login, register } from "../auth.js";

class AuthForm extends HTMLElement {
  connectedCallback() {
    const mode = this.getAttribute("mode") || "login";
    const isRegister = mode === "register";

    this.innerHTML = `
      <form>
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">${isRegister ? "Register" : "Login"}</button>
      <p class="error" hidden></p>
      </form>
      ${isRegister
        ? `<p class="auth-switch">Already have an account? <a href="#/login">Sign in</a></p>`
        : `<a href="#/register" class="auth-switch-cta">Create an account</a>`}
    `;

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
