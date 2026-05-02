"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Ticket,
  Users,
  Star,
  Crown,
  CircleDot,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, ApiError, type MatchItem } from "@/lib/api";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Flag } from "@/components/Flag";
import { LiveStatus } from "@/components/LiveStatus";

type Zones = Record<string, number>;

const EASE = [0.22, 1, 0.36, 1] as const;
const ZONE_ORDER = ["VIP", "Or", "Standard", "Populaire"];

const ZONE_STYLES: Record<string, {
  gradient: string;
  border: string;
  glow: string;
  icon: string;
  badge: string;
}> = {
  VIP: {
    gradient: "from-violet-400/20 via-purple-500/10 to-transparent",
    border: "border-violet-400/30 hover:border-violet-300/60",
    glow: "bg-violet-400/20",
    icon: "text-violet-400",
    badge: "bg-violet-400/15 text-violet-300",
  },
  Or: {
    gradient: "from-yellow-300/15 via-orange-400/8 to-transparent",
    border: "border-yellow-300/25 hover:border-yellow-200/50",
    glow: "bg-yellow-300/15",
    icon: "text-yellow-300",
    badge: "bg-yellow-300/10 text-yellow-200",
  },
  Standard: {
    gradient: "from-cyan-400/15 via-blue-500/8 to-transparent",
    border: "border-cyan-400/25 hover:border-cyan-300/50",
    glow: "bg-cyan-400/15",
    icon: "text-cyan-400",
    badge: "bg-cyan-400/10 text-cyan-300",
  },
  Populaire: {
    gradient: "from-emerald-400/15 via-green-500/8 to-transparent",
    border: "border-emerald-400/25 hover:border-emerald-300/50",
    glow: "bg-emerald-400/15",
    icon: "text-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-300",
  },
};

export default function MatchDetailPage({ params }: { params: { id: string } }) {
  const [matchMeta, setMatchMeta] = useState<MatchItem | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null); // UUID résolu
  const [zones, setZones] = useState<Zones | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Résoudre slug ou UUID → MatchItem + UUID réel
  useEffect(() => {
    let cancelled = false;
    api.getMatches()
      .then((matches) => {
        if (cancelled) return;
        const found = matches.find((m) => m.id === params.id || m.slug === params.id);
        if (found) { setMatchMeta(found); setMatchId(found.id); }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [params.id]);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    api.matchAvailability(matchId)
      .then((r) => { if (!cancelled) setZones(r.zones); })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? `API ${e.status}` : "Backend indisponible");
      });
    return () => { cancelled = true; };
  }, [matchId]);

  const total = zones ? Object.values(zones).reduce((a, b) => a + b, 0) : null;

  return (
    <div className="relative">
      <AuroraBackground />

      {/* Hero */}
      <section className="relative h-[52vh] min-h-[420px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/50 via-navy-950/30 to-navy-900" />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-10">
          <Link
            href="/matches"
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-navy-900/50 px-3 py-1.5 text-sm text-white/70 backdrop-blur-md transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <ArrowLeft size={14} />
            Retour aux matchs
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-full bg-cyan-400 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-navy-950 shadow-glow">
                  {matchMeta?.stage ?? "Match"}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                  /{matchMeta?.slug ?? params.id}
                </span>
              </div>

              {matchMeta ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="flex flex-wrap items-center gap-6"
                >
                  <div className="flex items-center gap-4">
                    <Flag code={matchMeta.home_team} size={56} />
                    <h1 className="heading-display text-5xl md:text-7xl">
                      {matchMeta.home_team}
                    </h1>
                  </div>
                  <span className="heading-display text-2xl text-cyan-400">VS</span>
                  <div className="flex items-center gap-4">
                    <h1 className="heading-display text-5xl md:text-7xl">
                      {matchMeta.away_team}
                    </h1>
                    <Flag code={matchMeta.away_team} size={56} />
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-32 animate-pulse rounded bg-navy-900/40" />
                  <span className="heading-display text-2xl text-cyan-400">VS</span>
                  <div className="h-10 w-32 animate-pulse rounded bg-navy-900/40" />
                </div>
              )}

              {matchMeta && (
                <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/70">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-cyan-400" aria-hidden />
                    {(() => { try { return new Date(matchMeta.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return matchMeta.date; } })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-cyan-400" aria-hidden />
                    {matchMeta.stadium}{matchMeta.city ? ` · ${matchMeta.city}` : ""}
                  </div>
                </dl>
              )}
            </div>

            <LiveStatus matchId={matchId} className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 backdrop-blur-md" />
          </div>
        </div>
      </section>

      {/* Zones */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Disponibilite
            </p>
            <h2 className="heading-display text-4xl md:text-5xl">
              Quatre <span className="text-cyan-400">zones</span>.
              <br /> Une seule vue.
            </h2>
          </div>
          {total !== null && (
            <span className="inline-flex items-center gap-2 text-sm text-white/60">
              <Users size={16} className="text-cyan-400" aria-hidden />
              <strong className="tabular-nums text-white">
                {total.toLocaleString("fr-FR")}
              </strong>{" "}
              sieges libres
            </span>
          )}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-200">
            Impossible de charger la disponibilite : {error}. Backend lance ?
          </div>
        ) : zones ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ZONE_ORDER.filter((z) => z in zones).map((z, i) => {
              const n = zones[z];
              const sold = n === 0;
              const style = ZONE_STYLES[z] ?? ZONE_STYLES.Standard!;
              const ZoneIcon = z === "VIP" ? Star : z === "Or" ? Crown : z === "Standard" ? CircleDot : Flame;
              return (
                <motion.div
                  key={z}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                  className={`group relative overflow-hidden rounded-2xl border p-6 backdrop-blur-sm transition-all ${
                    sold
                      ? "border-white/5 bg-navy-900/40"
                      : `${style.border} bg-navy-900/60 hover:-translate-y-1`
                  }`}
                >
                  {!sold && (
                    <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full ${style.glow} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100`} />
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />

                  <div className={`absolute inset-0 flex items-center justify-center translate-x-20 rotate-12 ${sold ? "opacity-[0.04]" : "opacity-[0.08] group-hover:opacity-[0.14]"} transition-opacity duration-500`}>
                    <ZoneIcon size={120} className={style.icon} strokeWidth={0.8} />
                  </div>

                  <div className="relative">
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${sold ? "bg-white/5 text-white/30" : style.badge}`}>
                        <Ticket size={10} /> Zone {z}
                      </span>
                    </div>
                    <div className={`heading-display text-5xl tabular-nums ${sold ? "text-white/30" : "text-white"}`}>
                      {n.toLocaleString("fr-FR")}
                    </div>
                    <div className={`mt-1 text-xs ${sold ? "text-white/20" : "text-white/50"}`}>
                      {sold ? "Complet" : "places libres"}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ZONE_ORDER.map((z) => (
              <div
                key={z}
                className="h-32 animate-pulse rounded-2xl border border-white/5 bg-navy-900/40"
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={`/matches/${matchMeta?.slug ?? params.id}/reserve`}>
            <Button size="lg" disabled={total === 0}>
              {total === 0 ? "Complet" : "Reserver des places"}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}