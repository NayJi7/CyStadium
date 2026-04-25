"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { api, ApiError, openLiveSocket, type LiveEvent } from "@/lib/api";
import { flagInfo } from "@/components/Flag";
import { AuroraBackground } from "@/components/AuroraBackground";
import { findMatch } from "@/lib/matches";

type Zones = Record<string, number>;

const EASE = [0.22, 1, 0.36, 1] as const;
const ZONE_ORDER = ["VIP", "Or", "Standard", "Populaire"];

export default function MatchDetailPage({ params }: { params: { id: string } }) {
  const meta = findMatch(params.id);
  const matchUuid = meta?.uuid ?? params.id;
  const home = meta ? flagInfo(meta.home) : null;
  const away = meta ? flagInfo(meta.away) : null;

  const [zones, setZones] = useState<Zones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .matchAvailability(matchUuid)
      .then((r) => !cancelled && setZones(r.zones))
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? `API ${e.status}` : "Backend indisponible");
      });
    return () => { cancelled = true; };
  }, [matchUuid]);

  useEffect(() => {
    let sock: WebSocket | null = null;
    try {
      sock = openLiveSocket(matchUuid, (_: LiveEvent) => setLiveCount((n) => n + 1));
    } catch {}
    return () => sock?.close();
  }, [matchUuid]);

  const total = zones ? Object.values(zones).reduce((a, b) => a + b, 0) : null;

  return (
    <div className="relative">
      <AuroraBackground />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative h-[52vh] min-h-[420px] overflow-hidden">
        {meta && (
          <Image
            src={meta.hero}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-40"
            priority
          />
        )}
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
                  {meta?.stage ?? "Match"}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                  /{params.id}
                </span>
              </div>

              {meta && home && away ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="flex flex-wrap items-center gap-6"
                >
                  <div className="flex items-center gap-4">
                    <Image
                      src={home.url}
                      alt={home.name}
                      width={120}
                      height={80}
                      className="h-14 w-auto rounded-sm shadow-xl ring-1 ring-white/20"
                      unoptimized
                    />
                    <h1 className="heading-display text-5xl md:text-7xl">
                      {home.name}
                    </h1>
                  </div>
                  <span className="heading-display text-2xl text-cyan-400">VS</span>
                  <div className="flex items-center gap-4">
                    <h1 className="heading-display text-5xl md:text-7xl">
                      {away.name}
                    </h1>
                    <Image
                      src={away.url}
                      alt={away.name}
                      width={120}
                      height={80}
                      className="h-14 w-auto rounded-sm shadow-xl ring-1 ring-white/20"
                      unoptimized
                    />
                  </div>
                </motion.div>
              ) : (
                <h1 className="heading-display text-5xl md:text-7xl">
                  Détail du <span className="text-cyan-400">match</span>
                </h1>
              )}

              {meta && (
                <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/70">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-cyan-400" aria-hidden />
                    {meta.date}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-cyan-400" aria-hidden />
                    {meta.stadium} · {meta.city}
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

      {/* ── Zones ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Disponibilité
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
              sièges libres
            </span>
          )}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-200">
            Impossible de charger la disponibilité : {error}. Backend lancé ?
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
              {total === 0 ? "Complet" : "Réserver des places"}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
