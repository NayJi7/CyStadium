// Stockage de la session côté client (localStorage).
// Le backend valide le header X-Session-Id à chaque requête protégée.

const KEY_SID   = "cystadium.session_id";
const KEY_USER  = "cystadium.username";
const KEY_CID   = "cystadium.client_id";
const KEY_ADMIN = "cystadium.is_admin";

export type SessionInfo = {
  sessionId: string;
  clientId:  string;
  username:  string;
  isAdmin:   boolean;
};

export function getSession(): SessionInfo | null {
  if (typeof window === "undefined") return null;
  const sessionId = window.localStorage.getItem(KEY_SID);
  const clientId  = window.localStorage.getItem(KEY_CID);
  const username  = window.localStorage.getItem(KEY_USER);
  if (!sessionId || !clientId || !username) return null;
  const isAdmin = window.localStorage.getItem(KEY_ADMIN) === "1";
  return { sessionId, clientId, username, isAdmin };
}

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_SID);
}

export const SESSION_EVENT = "cystadium:session";

export function setSession(info: SessionInfo): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_SID,   info.sessionId);
  window.localStorage.setItem(KEY_CID,   info.clientId);
  window.localStorage.setItem(KEY_USER,  info.username);
  window.localStorage.setItem(KEY_ADMIN, info.isAdmin ? "1" : "0");
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_SID);
  window.localStorage.removeItem(KEY_CID);
  window.localStorage.removeItem(KEY_USER);
  window.localStorage.removeItem(KEY_ADMIN);
  window.dispatchEvent(new Event(SESSION_EVENT));
}
