import "../components/auth-form.js";

export function render(container) {
  container.innerHTML = `<h1>Create an Account</h1>`;
  const form = document.createElement("auth-form");
  form.setAttribute("mode", "register");
  container.appendChild(form);
}
