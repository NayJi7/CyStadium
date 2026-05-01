"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Radio,
  Ticket,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, ApiError, openLiveSocket, type LiveEvent, type MatchItem } from "@/lib/api";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Flag } from "@/components/Flag";

type Zones = Record<string, number>;

const EASE = [0.22, 1, 0.36, 1] as const;
const ZONE_ORDER = ["VIP", "Or", "Standard", "Populaire"];

export default function MatchDetailPage({ params }: { params: { id: string } }) {
  const [matchMeta, setMatchMeta] = useState<MatchItem | null>(null);
  const [zones, setZones] = useState<Zones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.getMatches()
      .then((matches) => {
        if (cancelled) return;
        const found = matches.find((m) => m.id === params.id);
        if (found) setMatchMeta(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;
    api.matchAvailability(params.id)
      .then((r) => { if (!cancelled) setZones(r.zones); })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? `API ${e.status}` : "Backend indisponible");
      });
    return () => { cancelled = true; };
  }, [params.id]);

  useEffect(() => {
    let sock: WebSocket | null = null;
    try {
      sock = openLiveSocket(params.id, (_: LiveEvent) => setLiveCount((n) => n + 1));
    } catch {}
    return () => sock?.close();
  }, [params.id]);

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
                  /{params.id}
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

            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 backdrop-blur-md">
              <Radio size={14} className="animate-pulse" aria-hidden />
              Live · {liveCount} events
            </span>
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
              return (
                <motion.div
                  key={z}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                  className={`rounded-2xl border p-6 backdrop-blur-sm transition-all ${
                    sold
                      ? "border-white/5 bg-navy-900/40 text-white/40"
                      : "border-white/10 bg-navy-900/60 hover:-translate-y-1 hover:border-cyan-400/40"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                      <Ticket size={12} /> Zone {z}
                    </span>
                  </div>
                  <div className="heading-display text-5xl tabular-nums">
                    {n.toLocaleString("fr-FR")}
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    {sold ? "Complet" : "places libres"}
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
          <Link href={`/matches/${params.id}/reserve`}>
            <Button size="lg" disabled={total === 0}>
              {total === 0 ? "Complet" : "Reserver des places"}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}