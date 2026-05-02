"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Ticket,
  ArrowRight,
  ShieldCheck,
  Clock,
  Trophy,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuroraBackground } from "@/components/AuroraBackground";
import { api, ApiError, type ReservationItem, type MatchItem } from "@/lib/api";
import { getSession } from "@/lib/session";

const Ball3D = dynamic(
  () => import("@/components/Ball3D").then((m) => m.Ball3D),
  { ssr: false, loading: () => null },
);

const EASE = [0.22, 1, 0.36, 1] as const;

const STATUS_BADGE = {
  pending: { label: "En attente", color: "bg-amber-400/10 text-amber-300 border-amber-400/30", icon: Clock },
  confirmed: { label: "Confirmee", color: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30", icon: ShieldCheck },
  paid: { label: "Payee", color: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30", icon: ShieldCheck },
  cancelled: { label: "Annulee", color: "bg-red-400/10 text-red-300 border-red-400/30", icon: AlertCircle },
  expired: { label: "Expiree", color: "bg-white/5 text-white/40 border-white/10", icon: Clock },
} as const;

const STATUS_FILTERS = ["all", "confirmed", "pending", "cancelled", "expired"] as const;

function statusBadge(status: string) {
  const s = (STATUS_BADGE as Record<string, { label: string; color: string; icon: typeof Clock }>)[status] ?? { label: status, color: "bg-white/5 text-white/40 border-white/10", icon: AlertCircle };
  return s;
}

const ZONE_COLORS: Record<string, string> = {
  VIP: "text-violet-300",
  Or: "text-yellow-300",
  Standard: "text-cyan-300",
  Populaire: "text-emerald-300",
};

export default function ReservationsPage() {
  const session = getSession();
  const [reservations, setReservations] = useState<ReservationItem[] | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    Promise.all([
      api.getReservations(session.sessionId),
      api.getMatches(),
    ]).then(([resData, matchData]) => {
      if (!cancelled) { setReservations(resData); setMatches(matchData); }
    }).catch((e) => {
      if (!cancelled) setError(e instanceof ApiError ? `API ${e.status}` : "Backend indisponible");
    });
    return () => { cancelled = true; };
  }, [session]);

  const filtered = reservations?.filter((r) =>
    statusFilter === "all" || r.status === statusFilter
  ) ?? [];

  const matchName = (matchId: string) => {
    const m = matches.find((x) => x.id === matchId);
    return m ? `${m.home_team} - ${m.away_team}` : matchId.slice(0, 8);
  };

  return (
    <div className="relative overflow-x-clip">
      <AuroraBackground />

      <section className="relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse at 60% 60%, black 35%, transparent 80%)",
          }}
        />

        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 py-16 md:min-h-[78vh] md:grid-cols-[1.1fr_1fr] md:py-20">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
            }}
            className="relative z-10 space-y-8"
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
              }}
              className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/50"
            >
              <span className="h-px w-10 bg-cyan-400/70" />
              <span className="font-mono">Mon espace</span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 28 },
                show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
              }}
              className="heading-display text-[clamp(3rem,7vw,6rem)] leading-[0.92]"
            >
              Mes
              <br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-gold-300 bg-clip-text text-transparent">
                  reservations
                </span>
                <motion.span
                  aria-hidden
                  className="absolute -inset-x-2 inset-y-0 -z-10 rounded-lg bg-cyan-400/10 blur-2xl"
                  animate={{ opacity: [0.4, 0.85, 0.4] }}
                  transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                />
              </span>
              .
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
              }}
              className="max-w-xl text-lg text-white/70"
            >
              Tickets, historique, confirmations.{" "}
              <span className="text-white">Tout au meme endroit</span>, synchronises
              en direct avec le backend.
            </motion.p>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
              }}
              className="flex flex-wrap items-center gap-4"
            >
              <Link href="/matches">
                <Button size="lg" className="group">
                  Trouver un match
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </Button>
              </Link>
              <Link href="/">
                <Button size="lg" variant="outline">
                  Retour
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: EASE, delay: 0.2 }}
            className="relative z-30 h-[640px] w-full"
          >
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-cyan-400/10 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
            >
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/15"
                  style={{
                    width: `${280 + i * 130}px`,
                    height: `${280 + i * 130}px`,
                  }}
                  animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
                  transition={{
                    duration: 38 + i * 8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              ))}
            </div>

            <Ball3D
              className="absolute inset-0 h-full w-full"
              spinSpeed={1.4}
            />

            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.35em] text-white/30">
              Trionda · Adidas · 2026
            </div>
          </motion.div>
        </div>
      </section>

      {/* Reservations list */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        {!session ? (
          <div className="text-center py-20 space-y-4">
            <ShieldCheck size={48} className="mx-auto text-white/20" />
            <h2 className="heading-display text-3xl">Connectez-vous</h2>
            <p className="text-white/50">Vous devez etre connecte pour voir vos reservations.</p>
            <Link href="/login">
              <Button size="lg">Se connecter</Button>
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-6 text-center text-red-200">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-300" />
            <p className="text-lg font-semibold">Erreur de chargement</p>
            <p className="mt-1 text-sm text-red-300/70">{error}. Le backend est-il lance ?</p>
          </div>
        ) : reservations === null ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/5 bg-navy-800/50" />
            ))}
          </div>
        ) : (reservations?.length ?? 0) === 0 ? (
          <div className="text-center py-20 space-y-4">
            <Ticket size={48} className="mx-auto text-white/20" />
            <h2 className="heading-display text-3xl">Pas encore de reservation</h2>
            <p className="text-white/50">Choisissez un match et reservez vos places.</p>
            <Link href="/matches">
              <Button size="lg" className="group">
                <CalendarDays size={18} aria-hidden />
                Voir les matchs
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status filter tabs */}
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => {
                const count = f === "all"
                  ? reservations!.length
                  : reservations!.filter((r) => r.status === f).length;
                if (f !== "all" && count === 0) return null;
                return (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      statusFilter === f
                        ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-300"
                        : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                    }`}
                  >
                    {f === "all" ? "Toutes" : STATUS_BADGE[f as keyof typeof STATUS_BADGE]?.label ?? f}
                    <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 ? (
              <p className="py-12 text-center text-white/40">Aucune reservation avec ce filtre.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((r, i) => {
                  const badge = statusBadge(r.status);
                  const Icon = badge.icon;
                  const seatZones = r.seats?.reduce<Record<string, number>>((acc, s) => {
                    acc[s.zone] = (acc[s.zone] || 0) + 1;
                    return acc;
                  }, {}) ?? {};
                  return (
                    <motion.div
                      key={r.reservation_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
                      className="rounded-2xl border border-white/10 bg-navy-800/50 p-5 backdrop-blur-sm transition-colors hover:border-cyan-400/30"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono text-white/40">{r.reservation_id.slice(0, 8)}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.color}`}>
                          <Icon size={10} />
                          {badge.label}
                        </span>
                      </div>

                      {/* Match name */}
                      <div className="text-sm font-semibold text-white/80 mb-2">
                        {matchName(r.match_id)}
                      </div>

                      {/* Seats detail by zone */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {Object.entries(seatZones).map(([zone, count]) => (
                          <span key={zone} className={`text-[11px] font-medium ${ZONE_COLORS[zone] ?? "text-white/50"}`}>
                            {zone}: {count}
                          </span>
                        )).reduce<React.ReactNode[]>((acc, el, idx) =>
                          idx === 0 ? [el] : [...acc, <span key={`sep-${idx}`} className="text-white/20">·</span>, el], []
                        )}
                      </div>

                      {/* Seat labels preview */}
                      <div className="text-[11px] text-white/30 mb-3 truncate">
                        {r.seats?.slice(0, 6).map((s) => s.label).join(", ")}
                        {(r.seats?.length ?? 0) > 6 && ` … +${(r.seats?.length ?? 0) - 6}`}
                      </div>

                      <div className="flex items-end justify-between">
                        <div className="text-sm text-white/50">
                          {r.seats?.length ?? 0} place{(r.seats?.length ?? 0) > 1 ? "s" : ""}
                        </div>
                        <div className="heading-display text-xl">
                          {r.total?.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) ?? "0,00 €"}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}