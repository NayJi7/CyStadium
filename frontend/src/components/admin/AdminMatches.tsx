"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { api, type AdminMatch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Flag } from "@/components/Flag";
import { AdminMatchModal } from "./AdminMatchModal";

export function AdminMatches({ sessionId }: { sessionId: string }) {
  const [matches, setMatches]           = useState<AdminMatch[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState<"create" | AdminMatch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMatch | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.adminMatches(sessionId).then(setMatches).finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.adminDeleteMatch(sessionId, deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("fr-FR", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="heading-display text-2xl text-white/80">{matches.length} matchs</h2>
        <Button size="md" onClick={() => setModal("create")}>
          <Plus size={16} /> Nouveau match
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl border border-white/5 bg-navy-800/50" />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/30">
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3 hidden md:table-cell">Date</th>
                <th className="px-4 py-3 hidden lg:table-cell">Stade</th>
                <th className="px-4 py-3">Places libres</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {matches.map((m) => (
                <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-navy-900/30 hover:bg-navy-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <Flag code={m.home_team} size={20} />
                      <span className="text-white/60 text-xs">vs</span>
                      <Flag code={m.away_team} size={20} />
                      <span>{m.home_team} · {m.away_team}</span>
                      {m.highlight && (
                        <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300">Affiche</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-white/50">{fmtDate(m.date)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-white/50">
                    {m.stadium}{m.city ? ` · ${m.city}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono tabular-nums ${m.free_seats === 0 ? "text-red-400" : "text-white"}`}>
                      {m.free_seats.toLocaleString("fr-FR")}
                      <span className="text-white/30">/{m.total_capacity.toLocaleString("fr-FR")}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      m.status === "open" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-white/30"
                    }`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setModal(m)}
                        className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:border-cyan-400/30 hover:text-cyan-300 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(m)}
                        className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:border-red-400/30 hover:text-red-300 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {matches.length === 0 && (
            <div className="py-12 text-center text-sm text-white/30">Aucun match</div>
          )}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <AdminMatchModal
            sessionId={sessionId}
            match={modal === "create" ? undefined : modal}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); load(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setDeleteTarget(null)} />
            <motion.div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="mb-4 flex items-center gap-3 text-red-400">
                <AlertTriangle size={20} />
                <span className="font-semibold">Supprimer ce match ?</span>
              </div>
              <p className="mb-2 text-sm text-white/60">
                <strong className="text-white">{deleteTarget.home_team} vs {deleteTarget.away_team}</strong><br />
                Cette action supprimera aussi tous les sièges et réservations associés.
              </p>
              <div className="mt-6 flex gap-3">
                <Button variant="outline" size="md" className="flex-1" onClick={() => setDeleteTarget(null)}>Annuler</Button>
                <Button size="md" className="flex-1 !bg-red-500/80 hover:!bg-red-500" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Suppression…" : "Supprimer"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
