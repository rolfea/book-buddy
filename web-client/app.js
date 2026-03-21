import { isLoggedIn, clearToken } from "./auth.js";

const routes = {
  "/login": () => import("./pages/login.js"),
  "/register": () => import("./pages/register.js"),
  "/books": () => import("./pages/books.js"),
  "/scanner": () => import("./pages/scanner.js"),
};

const authRequired = new Set(["/books", "/scanner"]);

function currentRoute() {
  const hash = location.hash.slice(1) || "/login";
  return hash.startsWith("/") ? hash : "/" + hash;
}

function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  if (isLoggedIn()) {
    nav.innerHTML = `
      <a href="#/books">My Books</a>
      <a href="#/scanner">Scan</a>
      <span class="spacer"></span>
      <a href="#" id="logout-link">Log out</a>
    `;
    nav.querySelector("#logout-link").addEventListener("click", (e) => {
      e.preventDefault();
      clearToken();
      location.hash = "#/login";
    });
  } else {
    nav.innerHTML = `
      <a href="#/login">Login</a>
      <a href="#/register">Register</a>
    `;
  }
}

async function navigate() {
  const route = currentRoute();
  const app = document.getElementById("app");

  if (authRequired.has(route) && !isLoggedIn()) {
    location.hash = "#/login";
    return;
  }

  if ((route === "/login" || route === "/register") && isLoggedIn()) {
    location.hash = "#/books";
    return;
  }

  const loader = routes[route] || routes["/login"];
  try {
    const mod = await loader();
    renderNav();
    app.innerHTML = "";
    mod.render(app);
  } catch (err) {
    app.innerHTML = `<p class="error">Failed to load page: ${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!location.hash) location.hash = "#/login";
  navigate();
});

window.addEventListener("hashchange", navigate);
