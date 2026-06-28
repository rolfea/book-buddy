import "../components/auth-form.js";

export function render(container) {
  container.innerHTML = "";
  const form = document.createElement("auth-form");
  form.setAttribute("mode", "login");
  container.appendChild(form);
}
