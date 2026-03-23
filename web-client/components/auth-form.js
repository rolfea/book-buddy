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
      <p style="margin-top:0.75rem;font-size:0.9rem">
        ${isRegister
          ? `Already have an account? <a href="#/login">Login</a>`
          : `No account? <a href="#/register">Register</a>`}
      </p>
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
