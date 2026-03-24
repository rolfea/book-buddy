import { request } from "./api.js";

let currentUser = null;

export async function checkSession() {
  try {
    currentUser = await request("GET", "/auth/me");
    return currentUser;
  } catch (err) {
    currentUser = null;
    return null;
  }
}

export function getUser() {
  return currentUser;
}

export function isLoggedIn() {
  return !!currentUser;
}

export async function login(email, password) {
  const data = await request("POST", "/auth/login", { email, password });
  await checkSession();
  return data;
}

export async function register(email, password) {
  const data = await request("POST", "/auth/register", { email, password });
  await checkSession();
  return data;
}

export async function logout() {
  await request("POST", "/auth/logout");
  currentUser = null;
  location.hash = "#/login";
}
