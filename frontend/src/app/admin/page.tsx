"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ShieldCheck, Activity, Database, Ticket, Users } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { flagInfo } from "@/components/Flag";
import { AuroraBackground } from "@/components/AuroraBackground";

const EASE = [0.22, 1, 0.36, 1] as const;

const KPI = [
  { label: "Réservations (24 h)", value: 1247,  icon: Ticket,      tint: "from-cyan-400 to-cyan-600" },
  { label: "Sessions actives",     value: 382,   icon: Users,       tint: "from-indigo-400 to-indigo-600" },
  { label: "Sièges libérés",       value: 91,    icon: Activity,    tint: "from-gold-300 to-gold-500" },
  { label: "SLA cohérence",        value: 99.99, suffix: " %" as const, decimals: 2, icon: ShieldCheck, tint: "from-emerald-400 to-emerald-600" },
] as const;

const RECENT = [
  { id: "a1", home: "FRA", away: "BRA", zone: "VIP",       qty: 2, at: "il y a 12 s", status: "confirmed" as const },
  { id: "a2", home: "GER", away: "ESP", zone: "Or",        qty: 4, at: "il y a 34 s", status: "confirmed" as const },
  { id: "a3", home: "ARG", away: "POR", zone: "Standard",  qty: 1, at: "il y a 48 s", status: "pending"   as const },
  { id: "a4", home: "MAR", away: "SEN", zone: "Populaire", qty: 3, at: "il y a 1 min", status: "confirmed" as const },
  { id: "a5", home: "ITA", away: "URU", zone: "VIP",       qty: 2, at: "il y a 1 min", status: "failed"    as const },
];

export default function AdminPage() {
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
              Vue temps réel : réservations, sièges, sessions, incidents.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Tous systèmes opérationnels
          </span>
        </motion.header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {KPI.map((k, i) => {
            const Icon = k.icon;
            const hasSuffix = "suffix" in k;
            const hasDec = "decimals" in k;
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
                            minimumFractionDigits: (k as { decimals: number }).decimals,
                            maximumFractionDigits: (k as { decimals: number }).decimals,
                          })
                        : Math.round(v).toLocaleString("fr-FR")
                    }
                  />
                  {hasSuffix ? <span className="text-cyan-400">{(k as { suffix: string }).suffix}</span> : null}
                </div>
                <p className="mt-1 text-sm text-white/50">{k.label}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="rounded-2xl border border-white/10 bg-navy-800/50 backdrop-blur-sm"
          >
            <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h2 className="heading-display text-2xl">Flux temps réel</h2>
              <span className="inline-flex items-center gap-2 text-xs text-white/50">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                Live
              </span>
            </header>
            <ul className="divide-y divide-white/5">
              {RECENT.map((r) => {
                const h = flagInfo(r.home);
                const a = flagInfo(r.away);
                const badge =
                  r.status === "confirmed"
                    ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/30"
                    : r.status === "pending"
                      ? "bg-amber-400/10 text-amber-300 border-amber-400/30"
                      : "bg-red-400/10 text-red-300 border-red-400/30";
                return (
                  <li key={r.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/5">
                    <div className="flex -space-x-2">
                      <Image src={h.url} alt={h.name} width={40} height={28} className="h-6 w-auto rounded-sm ring-2 ring-navy-900" unoptimized />
                      <Image src={a.url} alt={a.name} width={40} height={28} className="h-6 w-auto rounded-sm ring-2 ring-navy-900" unoptimized />
                    </div>
                    <div className="flex-1 text-sm">
                      <p className="font-semibold">
                        {r.home} <span className="text-cyan-400">·</span> {r.away}
                      </p>
                      <p className="text-xs text-white/50">
                        Zone {r.zone} · {r.qty} place{r.qty > 1 ? "s" : ""} · {r.at}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge}`}>
                      {r.status}
                    </span>
                  </li>
                );
              })}
            </ul>
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
              <div className="space-y-3">
                {[
                  { name: "MatchManager",       load: 64 },
                  { name: "SessionManager",     load: 38 },
                  { name: "ReservationHandler", load: 82 },
                  { name: "PaymentHandler",     load: 21 },
                ].map((s) => (
                  <div key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-white/70">{s.name}</span>
                      <span className="font-mono tabular-nums text-white/50">{s.load} %</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-navy-900/60">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${s.load}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, ease: EASE }}
                        className={`h-full rounded-full ${s.load > 75 ? "bg-amber-400" : "bg-cyan-400"}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-navy-800/50 p-6 backdrop-blur-sm">
              <h3 className="heading-display text-xl mb-4 flex items-center gap-2">
                <Database size={16} className="text-cyan-400" /> Base de données
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-white/60">Connexions</dt>
                  <dd className="font-mono tabular-nums">12 / 50</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/60">Requêtes/s</dt>
                  <dd className="font-mono tabular-nums">148</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/60">Latence p95</dt>
                  <dd className="font-mono tabular-nums">4.2 ms</dd>
                </div>
              </dl>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
