"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AdminMatch, type AdminReservation } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-yellow-400/10 text-yellow-300",
  paid:      "bg-emerald-400/10 text-emerald-300",
  confirmed: "bg-emerald-400/10 text-emerald-300",
  cancelled: "bg-white/5 text-white/30",
  expired:   "bg-white/5 text-white/30",
};

export function AdminReservations({ sessionId }: { sessionId: string }) {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [matches, setMatches]           = useState<AdminMatch[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [matchFilter, setMatchFilter]   = useState("");
  const [loading, setLoading]           = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.adminReservations(sessionId, statusFilter || undefined, matchFilter || undefined),
      api.adminMatches(sessionId),
    ])
      .then(([res, ms]) => { setReservations(res); setMatches(ms); })
      .finally(() => setLoading(false));
  }, [sessionId, statusFilter, matchFilter]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString("fr-FR", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="heading-display text-2xl text-white/80 flex-1">{reservations.length} réservations</h2>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-navy-900 px-3 py-1.5 text-sm text-white/70 focus:outline-none">
          <option value="">Tous statuts</option>
          {["pending","paid","confirmed","cancelled"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={matchFilter} onChange={e => setMatchFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-navy-900 px-3 py-1.5 text-sm text-white/70 focus:outline-none">
          <option value="">Tous matchs</option>
          {matches.map(m => (
            <option key={m.id} value={m.id}>{m.home_team} vs {m.away_team}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0,1,2,3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl border border-white/5 bg-navy-800/50" />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/30">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3 hidden md:table-cell">Client</th>
                <th className="px-4 py-3">Places</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reservations.map(r => (
                <tr key={r.reservation_id} className="bg-navy-900/30 hover:bg-navy-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-white/40 text-xs">{r.reservation_id.slice(0,8)}</td>
                  <td className="px-4 py-3 text-white/80">{r.match_name}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-white/50">{r.client_email}</td>
                  <td className="px-4 py-3 tabular-nums text-white">{r.seats}</td>
                  <td className="px-4 py-3 tabular-nums text-white">{r.total.toLocaleString("fr-FR")} €</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[r.status] ?? "bg-white/5 text-white/30"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-white/40 text-xs">{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {reservations.length === 0 && (
            <div className="py-12 text-center text-sm text-white/30">Aucune réservation trouvée</div>
          )}
        </div>
      )}
    </div>
  );
}
