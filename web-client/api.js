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

/**
 * Parses Go's sql.NullString shape into a standard JS string.
 * Handles both the serialized Go NullString object { String, Valid } and standard strings.
 * @param {*} val - Value to parse
 * @returns {string}
 */
export function parseNullString(val) {
  if (!val) return "";
  if (typeof val === "object" && val.Valid) {
    return val.String;
  }
  if (typeof val === "string") {
    return val;
  }
  return "";
}
