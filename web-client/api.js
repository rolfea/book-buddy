const BASE = (typeof window !== "undefined" ? window.API_BASE_URL : "") || "";

export async function request(method, path, body) {
  const headers = {
    "Content-Type": "application/json",
    "X-BookBuddy-Request": "true",
  };

  const opts = {
    method,
    headers,
    credentials: "include",
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  // Prefix path with /api if not already present
  const fullPath = path.startsWith("/api") ? path : "/api" + path;
  const res = await fetch(BASE + fullPath, opts);

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}
