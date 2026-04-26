"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Activity, Database, Ticket, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { CountUp } from "@/components/CountUp";
import { AuroraBackground } from "@/components/AuroraBackground";

const EASE = [0.22, 1, 0.36, 1] as const;

type KpiData = {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon: typeof Ticket;
  tint: string;
};

export default function AdminPage() {
  const session = getSession();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    // Try fetching matches for basic KPIs (total matches, etc.)
    api.getMatches(session.sessionId)
      .then((matches) => {
        if (cancelled) return;
        setKpis([
          { label: "Matchs disponibles", value: matches.length, icon: Ticket, tint: "from-cyan-400 to-cyan-600" },
          { label: "Sessions actives", value: 0, icon: Users, tint: "from-indigo-400 to-indigo-600" },
          { label: "Reservations (24h)", value: 0, icon: Activity, tint: "from-gold-300 to-gold-500" },
          { label: "SLA coherence", value: 0, suffix: " %", decimals: 0, icon: ShieldCheck, tint: "from-emerald-400 to-emerald-600" },
        ]);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? `API ${e.status}` : "Backend indisponible");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session]);

  return (
    <div className="relative">
      <AuroraBackground />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-12 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/50">
              <span className="h-px w-10 bg-cyan-400/70" />
              <span className="font-mono">Supervision</span>
            </div>
            <h1 className="heading-display text-[clamp(3rem,7vw,6rem)] leading-[0.92]">
              <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-gold-300 bg-clip-text text-transparent">
                Admin
              </span>{" "}
              · dashboard
            </h1>
            <p className="mt-4 max-w-xl text-white/65 text-lg">
              Vue temps reel : reservations, sieges, sessions, incidents.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Tous systemes operationnels
          </span>
        </motion.header>

        {!session ? (
          <div className="rounded-lg border border-gold-300/30 bg-gold-300/5 p-8 text-center">
            <ShieldCheck size={40} className="mx-auto mb-3 text-gold-300/50" />
            <p className="text-lg text-white/70">Connectez-vous avec un compte admin pour acceder au dashboard.</p>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {loading ? (
                [0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/5 bg-navy-800/50" />
                ))
              ) : kpis.map((k, i) => {
                const Icon = k.icon;
                const hasSuffix = "suffix" in k && k.suffix;
                const hasDec = "decimals" in k && k.decimals !== undefined;
                return (
                  <motion.div
                    key={k.label}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-navy-800/50 p-6 backdrop-blur-sm transition-colors hover:border-cyan-400/40"
                  >
                    <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${k.tint} opacity-10 blur-2xl transition-opacity group-hover:opacity-25`} />
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20">
                      <Icon size={18} strokeWidth={2} aria-hidden />
                    </div>
                    <div className="heading-display text-4xl tabular-nums">
                      <CountUp
                        to={k.value}
                        format={(v) =>
                          hasDec
                            ? v.toLocaleString("fr-FR", {
                                minimumFractionDigits: k.decimals!,
                                maximumFractionDigits: k.decimals!,
                              })
                            : Math.round(v).toLocaleString("fr-FR")
                        }
                      />
                      {hasSuffix ? <span className="text-cyan-400">{k.suffix}</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-white/50">{k.label}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Empty state for live data */}
            <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: EASE }}
                className="rounded-2xl border border-white/10 bg-navy-800/50 backdrop-blur-sm"
              >
                <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                  <h2 className="heading-display text-2xl">Flux temps reel</h2>
                  <span className="inline-flex items-center gap-2 text-xs text-white/50">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                    Live
                  </span>
                </header>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Activity size={36} className="mb-3 text-white/15" />
                  <p className="text-white/40 text-sm">En attente du flux temps reel du backend</p>
                  <p className="text-white/25 text-xs mt-1">Les evenements apparaitront ici une fois ReservationHandler connecte</p>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-white/10 bg-navy-800/50 p-6 backdrop-blur-sm">
                  <h3 className="heading-display text-xl mb-4">Acteurs Akka</h3>
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Database size={28} className="mb-2 text-white/15" />
                    <p className="text-white/40 text-sm">Donnees des acteurs bientot disponibles</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-navy-800/50 p-6 backdrop-blur-sm">
                  <h3 className="heading-display text-xl mb-4 flex items-center gap-2">
                    <Database size={16} className="text-cyan-400" /> Base de donnees
                  </h3>
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <p className="text-white/40 text-sm">Statistiques DB bientot disponibles</p>
                  </div>
                </div>
              </motion.section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}