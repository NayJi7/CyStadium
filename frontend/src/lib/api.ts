// Client HTTP vers le backend Akka HTTP.
// Base URL : NEXT_PUBLIC_API_URL, par défaut http://localhost:8080.

import { clearSession } from "./session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `API error ${status}`);
  }
}

type FetchOpts = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
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

  if (!res.ok) {
    if (res.status === 401 && opts.sessionId) {
      clearSession();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cystadium:session-expired"));
      }
    }
    throw new ApiError(res.status, payload);
  }
  return payload as T;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type LoginResponse = { session_id: string; client_id: string; username: string; is_admin: boolean };
export type RegisterResponse = { client_id: string; username: string; is_admin: boolean };

export type MatchItem = {
  id: string;
  home_team: string;
  away_team: string;
  date: string;
  stadium: string;
  slug: string;        // ex: "france-bresil" — pour les URLs lisibles
  city?: string;
  stage?: string;
  highlight?: boolean;
  zones?: Record<string, number>;
};

export type ZoneInfo = {
  zone_id: string;
  name: string;
  price: number;
  available: number;
};

export type SeatInfo = {
  seat_id: string;
  label?: string;
  row: string;        // char: 'A', 'B', … (depuis la DB)
  number: number;
  zone: string;
  status: string;
  section?: string;
};

// Type retourné par GET /api/reservations et GET /api/reservations/{id}
export type ReservationSeatInfo = {
  seat_id: string;
  label: string;
  zone: string;
  status: string;
};

export type ReservationItem = {
  reservation_id: string;
  match_id: string;
  seats: ReservationSeatInfo[];
  total: number;
  status: string;
  expires_at?: number;  // epoch millis
};

// Type retourné par POST /api/reservations (SeatsReserved)
export type SeatsReservedResponse = {
  reservation_id: string;
  seat_ids: string[];
  total: number;
  expires_at: number;
};

// ── API ──────────────────────────────────────────────────────────────────────

export const api = {
  // Auth
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
    request<MeResponse>("/api/auth/me", { method: "GET", sessionId }),

  // Matches
  getMatches: (sessionId?: string) =>
    request<MatchItem[]>("/api/matches", { sessionId }),

  getMatchDetail: (matchId: string, sessionId?: string) =>
    request<{ match_id: string; zones: Record<string, number> }>(
      `/api/matches/${matchId}`,
      { sessionId }
    ),

  getMatchZones: (matchId: string, sessionId?: string) =>
    request<ZoneInfo[]>(`/api/matches/${matchId}/zones`, { sessionId }),

  getMatchSeats: (matchId: string, sessionId?: string) =>
    request<SeatInfo[]>(`/api/matches/${matchId}/seats`, { sessionId }),

  // Reservations
  createReservation: (matchId: string, zone: string, seatIds: string[], sessionId: string) =>
    request<SeatsReservedResponse>("/api/reservations", {
      method: "POST",
      sessionId,
      body: { match_id: matchId, zone, seat_ids: seatIds, session_id: sessionId },
    }),

  payReservation: (reservationId: string, amount: number, sessionId: string) =>
    request<PaymentSuccessResponse>(`/api/reservations/${reservationId}/pay`, {
      method: "POST",
      sessionId,
      body: { reservation_id: reservationId, amount },
    }),

  cancelReservation: (reservationId: string, sessionId: string) =>
    request<{ reservation_id: string }>(`/api/reservations/${reservationId}/cancel`, {
      method: "POST",
      sessionId,
      body: { reservation_id: reservationId, reason: "user_cancel" },
    }),

  getReservation: (reservationId: string, sessionId: string) =>
    request<ReservationItem>(`/api/reservations/${reservationId}`, { sessionId }),

  getReservations: (sessionId: string) =>
    request<ReservationItem[]>("/api/reservations", { sessionId }),

  // Keep legacy name for backwards compat
  matchAvailability: (matchId: string, sessionId?: string) =>
    request<{ match_id: string; zones: Record<string, number> }>(
      `/api/matches/${matchId}`,
      { sessionId }
    ),

  // Admin
  adminStats: (sessionId: string, period = "30d") =>
    request<AdminStats>(`/api/admin/stats?period=${period}`, { sessionId }),

  adminMatches: (sessionId: string) =>
    request<AdminMatch[]>("/api/admin/matches", { sessionId }),

  adminCreateMatch: (sessionId: string, body: {
    home_team: string; away_team: string; date: string;
    stadium: string; city?: string; stage?: string;
    total_capacity: number; zones: Record<string, number>; highlight: boolean;
  }) =>
    request<AdminMatch>("/api/admin/matches", { method: "POST", sessionId, body }),

  adminUpdateMatch: (sessionId: string, id: string, body: Partial<{
    home_team: string; away_team: string; date: string;
    stadium: string; city: string; stage: string; highlight: boolean;
    total_capacity: number; zones: Record<string, number>;
  }>) =>
    request<AdminMatch>(`/api/admin/matches/${id}`, { method: "PUT", sessionId, body }),

  adminDeleteMatch: (sessionId: string, id: string) =>
    request<void>(`/api/admin/matches/${id}`, { method: "DELETE", sessionId }),

  adminReservations: (sessionId: string, status?: string, matchId?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (matchId) params.set("matchId", matchId);
    const qs = params.toString();
    return request<AdminReservation[]>(`/api/admin/reservations${qs ? "?" + qs : ""}`, { sessionId });
  },

  adminUsers: (sessionId: string) =>
    request<AdminUser[]>("/api/admin/users", { sessionId }),

  adminPatchUser: (sessionId: string, userId: string, isAdmin: boolean) =>
    request<unknown>(`/api/admin/users/${userId}`, {
      method: "PATCH", sessionId, body: { is_admin: isAdmin },
    }),

  getActorStatus: (sessionId: string) =>
    request<any>(`/api/admin/actors`, { sessionId }),
};

export type PaymentSuccessResponse = {
  reservation_id: string;
  transaction_id: string;
};

// ── WebSocket live ────────────────────────────────────────────────────────────
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

export type LiveEvent =
  | { type: "seat_status"; match_id: string; seat_id: string; status: "free" | "reserved" | "confirmed" | "locked" }
  | { type: "reservation_count"; match_id: string; count: number };

// ── Admin types ──────────────────────────────────────────────────────────────

export type MeResponse = { client_id: string; is_admin: boolean };

export type AdminStats = {
  kpis: {
    total_revenue: number;
    total_reservations: number;
    avg_occupancy: number;
    total_free_seats: number;
  };
  reservations_over_time: { date: string; count: number }[];
  occupancy_by_zone: { zone: string; free: number; occupied: number }[];
  revenue_by_match: { match_name: string; revenue: number }[];
};

export type AdminMatch = {
  id: string;
  home_team: string; away_team: string;
  date: string; stadium: string;
  city?: string; stage?: string;
  slug: string; highlight: boolean; status: string;
  zones: Record<string, number>;
  total_capacity: number; free_seats: number;
};

export type AdminUser = {
  id: string; email: string; name: string; username: string; is_admin: boolean;
};

export type AdminReservation = {
  reservation_id: string; match_id: string; match_name: string;
  client_email: string; seats: number; total: number;
  status: string; created_at: number;
};