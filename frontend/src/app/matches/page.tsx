"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, ArrowRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { flagInfo } from "@/components/Flag";
import { AuroraBackground } from "@/components/AuroraBackground";
import { api, ApiError, type MatchItem } from "@/lib/api";

const EASE = [0.22, 1, 0.36, 1] as const;

const ZONE_ORDER = ["VIP", "Or", "Standard", "Populaire"] as const;

function fmtDate(raw: string | number): string {
  try {
    const d = new Date(raw);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(raw);
  }
}

function MatchCard({ m }: { m: MatchItem }) {
  const home = flagInfo(m.home_team);
  const away = flagInfo(m.away_team);
  const zones = m.zones ?? {};
  const total = Object.values(zones).reduce((a: number, b: number) => a + b, 0);
  const soldOut = total === 0;

  return (
    <motion.article
      whileHover={{ y: -8 }}
      transition={{ duration: 0.25, ease: EASE }}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-navy-800/50 backdrop-blur-sm transition-colors duration-300 ${
        m.highlight
          ? "border-cyan-400/40 shadow-glow"
          : "border-white/10 hover:border-cyan-400/30"
      }`}
    >
      <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/0 blur-3xl transition-all duration-500 group-hover:bg-cyan-400/15" />
      <div className="relative h-44 overflow-hidden bg-navy-900">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/40 via-navy-950/20 to-navy-900" />

        {m.highlight && (
          <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-cyan-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-navy-950 shadow-glow">
            <Flame size={12} /> A l&apos;affiche
          </span>
        )}

        <span className="absolute right-4 top-4 z-10 rounded-full bg-navy-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/70 backdrop-blur-md">
          {m.stage ?? "Match"}
        </span>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-5 pb-3">
          <div className="flex flex-col items-center">
            <Image
              src={home.url}
              alt={home.name}
              width={80}
              height={54}
              className="h-10 w-auto rounded-sm shadow-lg ring-1 ring-white/20"
              unoptimized
            />
            <span className="mt-1 text-[10px] font-bold tracking-wider text-white">
              {m.home_team}
            </span>
          </div>
          <span className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
            VS
          </span>
          <div className="flex flex-col items-center">
            <Image
              src={away.url}
              alt={away.name}
              width={80}
              height={54}
              className="h-10 w-auto rounded-sm shadow-lg ring-1 ring-white/20"
              unoptimized
            />
            <span className="mt-1 text-[10px] font-bold tracking-wider text-white">
              {m.away_team}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="heading-display text-2xl">
          {home.name} <span className="text-cyan-400">&middot;</span> {away.name}
        </h2>

        <dl className="mt-4 space-y-2 text-sm text-white/70">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-cyan-400" aria-hidden />
            <span>{fmtDate(m.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-cyan-400" aria-hidden />
            <span>
              {m.stadium} {m.city ? <span className="text-white/50">&middot; {m.city}</span> : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-cyan-400" aria-hidden />
            <span>
              <strong className="tabular-nums text-white">
                {total.toLocaleString("fr-FR")}
              </strong>{" "}
              sieges libres
            </span>
          </div>
        </dl>

        {Object.keys(zones).length > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {ZONE_ORDER.filter((z) => z in zones).map((z) => {
              const n = zones[z];
              const sold = n === 0;
              return (
                <div
                  key={z}
                  className={`rounded-md border px-2 py-1.5 text-center ${
                    sold
                      ? "border-white/5 bg-navy-900/40 text-white/30"
                      : "border-white/10 bg-navy-900/60"
                  }`}
                >
                  <div className="text-[9px] uppercase tracking-wider text-white/40">
                    {z}
                  </div>
                  <div className="font-mono text-sm font-bold tabular-nums">{n}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 pt-2">
          {soldOut ? (
            <Button variant="outline" size="md" className="w-full" disabled>
              Complet
            </Button>
          ) : (
            <Link href={`/matches/${m.id}`} className="block">
              <Button size="md" variant="outline" className="group w-full">
                Voir le match
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function MatchCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-navy-800/50">
      <div className="h-44 animate-pulse bg-navy-900/60" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="h-7 w-3/4 animate-pulse rounded bg-navy-900/40" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-navy-900/30" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-navy-900/30" />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-navy-900/40" />
          ))}
        </div>
        <div className="mt-auto h-10 animate-pulse rounded-md bg-navy-900/30" />
      </div>
    </div>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getMatches()
      .then((data) => {
        if (!cancelled) setMatches(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? `API ${e.status}` : "Backend indisponible");
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
      <AuroraBackground />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-14 flex flex-wrap items-end justify-between gap-6"
        >
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/50"
            >
              <span className="h-px w-10 bg-cyan-400/70" />
              <span className="font-mono">Saison 2026</span>
            </motion.div>
            <h1 className="heading-display text-[clamp(3rem,7vw,6rem)] leading-[0.92]">
              Les{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-gold-300 bg-clip-text text-transparent">
                  matchs
                </span>
                <motion.span
                  aria-hidden
                  className="absolute -inset-x-2 inset-y-0 -z-10 rounded-lg bg-cyan-400/10 blur-2xl"
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/65">
              64 affiches. 16 stades.{" "}
              <span className="text-white">Choisis ton choc</span> et reserve en
              quelques secondes.
            </p>
          </div>
          {matches && (
            <div className="flex items-center gap-3 text-sm text-white/50">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 text-cyan-300 backdrop-blur-sm">
                <Flame size={14} /> {matches.length} affiches disponibles
              </span>
            </div>
          )}
        </motion.header>

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-6 text-center text-red-200">
            <p className="text-lg font-semibold">Impossible de charger les matchs</p>
            <p className="mt-1 text-sm text-red-300/70">{error}. Le backend est-il lance ?</p>
          </div>
        ) : matches ? (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((m, i) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.06, ease: EASE }}
              >
                <MatchCard m={m} />
              </motion.li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i}><MatchCardSkeleton /></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}