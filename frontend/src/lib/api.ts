// Client HTTP vers le backend Akka HTTP.
// Base URL : NEXT_PUBLIC_API_URL, par défaut http://localhost:8080.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `API error ${status}`);
  }
}

type FetchOpts = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  sessionId?: string;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.sessionId) headers["X-Session-Id"] = opts.sessionId;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("content-type") ?? "";
  const payload = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) throw new ApiError(res.status, payload);
  return payload as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export type LoginResponse   = { session_id: string; client_id: string; username: string; is_admin: boolean };
export type RegisterResponse = { client_id: string; username: string; is_admin: boolean };

export const api = {
  register: (username: string, password: string, email: string, name: string) =>
    request<RegisterResponse>("/api/auth/register", {
      body: { username, password, email, name },
    }),

  login: (username: string, password: string) =>
    request<LoginResponse>("/api/auth/login", {
      body: { username, password },
    }),

  logout: (sessionId: string) =>
    request<void>("/api/auth/logout", { method: "POST", sessionId }),

  me: (sessionId: string) =>
    request<{ client_id: string }>("/api/auth/me", { method: "GET", sessionId }),

  // Disponibilité d'un match (branché quand MatchManager sera prêt)
  matchAvailability: (matchId: string, sessionId?: string) =>
    request<{ match_id: string; zones: Record<string, number> }>(
      `/api/matches/${matchId}`,
      { sessionId }
    ),
};

// ── WebSocket live ───────────────────────────────────────────────────────────
export function openLiveSocket(matchId: string, onMessage: (ev: LiveEvent) => void): WebSocket {
  const wsUrl = API_URL.replace(/^http/, "ws");
  const socket = new WebSocket(`${wsUrl}/ws/matches/${matchId}/live`);
  socket.addEventListener("message", (e) => {
    try {
      onMessage(JSON.parse(e.data) as LiveEvent);
    } catch {
      // ignore malformed frames
    }
  });
  return socket;
}

export type LiveEvent = {
  match_id: string;
  seat_id: string;
  status: "free" | "reserved" | "confirmed" | "locked";
};
