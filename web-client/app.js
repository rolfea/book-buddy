import { isLoggedIn, checkSession, logout } from "./auth.js";

const routes = {
  "/login": () => import("./pages/login.js"),
  "/register": () => import("./pages/register.js"),
  "/books": () => import("./pages/books.js"),
  "/scanner": () => import("./pages/scanner.js"),
};

const authRequired = new Set(["/books", "/scanner"]);

function currentRoute() {
  const hash = (location.hash.slice(1) || "/login").split("?")[0];
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
      <button id="logout-btn" style="background:none;border:none;color:inherit;cursor:pointer;padding:0;font:inherit;text-decoration:underline;">Log out</button>
    `;
    const btn = nav.querySelector("#logout-btn");
    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        await logout();
        navigate();
      });
    }
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
    app.innerHTML = "";
    mod.render(app);
    renderNav();
  } catch (err) {
    app.innerHTML = `<div class="error-page">
      <h1>Failed to load page</h1>
      <p>${err.message}</p>
      <button onclick="location.reload()">Retry</button>
    </div>`;
  }
}

async function init() {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="loading">Loading...</div>`;

  // 1. Health check
  try {
    const res = await fetch((window.API_BASE_URL || "") + "/health");
    if (!res.ok) throw new Error("API not healthy");
  } catch (err) {
    app.innerHTML = `<div class="error-page">
      <h1>Service Unreachable</h1>
      <p>The Book Buddy backend is currently offline. Please try again in a few minutes.</p>
      <button onclick="location.reload()">Retry</button>
    </div>`;
    return;
  }

  // 2. Auth check
  await checkSession();

  // 3. Initial navigation
  if (!location.hash) location.hash = "#/login";
  navigate();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", navigate);
