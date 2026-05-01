"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { api, type AdminMatch } from "@/lib/api";
import { Button } from "@/components/ui/Button";

const EASE = [0.22, 1, 0.36, 1] as const;
const ZONES = ["VIP", "Or", "Standard", "Populaire"] as const;

type Props = {
  sessionId: string;
  match?: AdminMatch;
  onClose: () => void;
  onSaved: () => void;
};

export function AdminMatchModal({ sessionId, match, onClose, onSaved }: Props) {
  const isEdit = !!match;
  const [form, setForm] = useState({
    home_team:      match?.home_team      ?? "",
    away_team:      match?.away_team      ?? "",
    date:           match ? new Date(match.date).toISOString().slice(0, 16) : "",
    stadium:        match?.stadium        ?? "",
    city:           match?.city           ?? "",
    stage:          match?.stage          ?? "",
    highlight:      match?.highlight      ?? false,
    total_capacity: match?.total_capacity ?? 0,
    vip:       match?.zones?.["VIP"]       ?? 0,
    or:        match?.zones?.["Or"]        ?? 0,
    standard:  match?.zones?.["Standard"]  ?? 0,
    populaire: match?.zones?.["Populaire"] ?? 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const zonesSum = form.vip + form.or + form.standard + form.populaire;
  const sumOk = isEdit || zonesSum === form.total_capacity;

  const set = (field: string, value: string | number | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && !sumOk) { setError("La somme des zones doit égaler la capacité totale."); return; }
    setSaving(true); setError(null);
    try {
      if (isEdit) {
        await api.adminUpdateMatch(sessionId, match!.id, {
          home_team: form.home_team, away_team: form.away_team,
          date: form.date, stadium: form.stadium,
          city: form.city || undefined, stage: form.stage || undefined,
          highlight: form.highlight,
        });
      } else {
        await api.adminCreateMatch(sessionId, {
          home_team: form.home_team, away_team: form.away_team,
          date: form.date, stadium: form.stadium,
          city: form.city || undefined, stage: form.stage || undefined,
          highlight: form.highlight,
          total_capacity: form.total_capacity,
          zones: { VIP: form.vip, Or: form.or, Standard: form.standard, Populaire: form.populaire },
        });
      }
      onSaved();
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl"
        style={{ maxHeight: "90vh" }}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.2, ease: EASE }}
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-white/40 hover:text-white">
          <X size={18} />
        </button>

        <h2 className="heading-display text-2xl mb-6">
          {isEdit ? "Modifier le match" : "Nouveau match"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["home_team","away_team"] as const).map(f => (
              <div key={f}>
                <label className="mb-1 block text-xs text-white/50">
                  {f === "home_team" ? "Équipe domicile" : "Équipe extérieure"}
                </label>
                <input required value={form[f]} onChange={e => set(f, e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/50">Date et heure</label>
            <input required type="datetime-local" value={form.date} onChange={e => set("date", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-white/50">Stade</label>
              <input required value={form.stadium} onChange={e => set("stadium", e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">Ville</label>
              <input value={form.city} onChange={e => set("city", e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/50">Phase (ex: Groupe A, Quarts de finale)</label>
            <input value={form.stage} onChange={e => set("stage", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
          </div>

          {!isEdit && (
            <>
              <div>
                <label className="mb-1 block text-xs text-white/50">Capacité totale du stade</label>
                <input required type="number" min={1} value={form.total_capacity || ""}
                  onChange={e => set("total_capacity", parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs text-white/50">
                  Places par zone
                  <span className={`ml-2 ${sumOk ? "text-emerald-400" : "text-red-400"}`}>
                    ({zonesSum}/{form.total_capacity})
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["vip","or","standard","populaire"] as const).map((z, i) => (
                    <div key={z}>
                      <div className="mb-1 text-center text-[10px] uppercase tracking-wider text-white/30">{ZONES[i]}</div>
                      <input type="number" min={0} value={form[z] || ""}
                        onChange={e => set(z, parseInt(e.target.value) || 0)}
                        className="w-full rounded-lg border border-white/10 bg-navy-800 px-2 py-2 text-center text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="highlight" checked={form.highlight}
              onChange={e => set("highlight", e.target.checked)}
              className="h-4 w-4 accent-cyan-400" />
            <label htmlFor="highlight" className="text-sm text-white/70">Match à l&apos;affiche</label>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" size="md" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" size="md" className="flex-1" disabled={saving || (!isEdit && !sumOk)}>
              {saving ? "Sauvegarde…" : isEdit ? "Enregistrer" : "Créer le match"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
