export interface User {
  id: number;
  email: string;
  username: string;
  role: "admin" | "player";
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
}

const TOKEN_KEY = "ab_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Erreur ${res.status}`);
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, username: string, password: string) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    }),
  me: () => request<{ user: User }>("/auth/me"),
  updateMe: (patch: { displayName?: string; bio?: string; avatar?: string }) =>
    request<{ user: User }>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  // ── Progression de jeu ──
  getGameState: <T = unknown>() => request<{ state: T | null }>("/game/state"),
  saveGameState: (state: unknown) =>
    request<{ ok: true }>("/game/state", {
      method: "PUT",
      body: JSON.stringify({ state }),
    }),
  resetGameState: () => request<{ ok: true }>("/game/state", { method: "DELETE" }),
};
