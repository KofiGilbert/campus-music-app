// Thin typed fetch layer for the admin dashboard. Admin endpoints are an
// internal surface (not part of the public OpenAPI client), so we call them
// directly with the stored access token. The API origin is configured via
// VITE_API_URL (e.g. https://campus-music-api.fly.dev); empty = same origin.

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const TOKEN_KEY = "campus_admin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 || res.status === 403) {
    // Token missing/expired or not an admin — bounce to login.
    clearToken();
    if (!location.pathname.endsWith("/login")) location.assign("/login");
    throw new ApiError(res.status, "Unauthorized");
  }
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new ApiError(res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

export interface LoginResult {
  accessToken: string;
  user: { id: string; name: string; isAdmin?: boolean };
}

/** Log in and keep the access token. Throws ApiError on bad credentials. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = (await res.text()) || "Login failed";
    throw new ApiError(res.status, text);
  }
  const data = (await res.json()) as LoginResult;
  setToken(data.accessToken);
  return data;
}
