"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Ticket,
  ArrowRight,
  ShieldCheck,
  Clock,
  Trophy,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuroraBackground } from "@/components/AuroraBackground";

const Ball3D = dynamic(
  () => import("@/components/Ball3D").then((m) => m.Ball3D),
  { ssr: false, loading: () => null },
);

const EASE = [0.22, 1, 0.36, 1] as const;

export default function ReservationsPage() {
  return (
    <div className="relative overflow-x-clip">
      <AuroraBackground />

      {/* ═════════════════════════════════════════════════════════════════
         HERO — Balle qui rebondit, full-bleed, deux colonnes
         ═════════════════════════════════════════════════════════════════ */}
      <section className="relative">
        {/* Grille fine en fond, comme la landing */}
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
          {/* Colonne texte */}
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
                  réservations
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
              <span className="text-white">Tout au même endroit</span> — synchronisés
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

            <motion.div
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { duration: 0.7, ease: EASE } },
              }}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-navy-900/40 p-4 backdrop-blur-sm max-w-md"
            >
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-cyan-400" />
              <p className="text-xs leading-relaxed text-white/55">
                Les confirmations atterrissent ici dès que{" "}
                <code className="rounded bg-cyan-400/10 px-1 py-0.5 text-cyan-300">
                  ReservationHandler
                </code>{" "}
                valide la transaction. Rollback automatique en cas d'échec.
              </p>
            </motion.div>
          </motion.div>

          {/* Colonne 3D — la balle qui rebondit */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: EASE, delay: 0.2 }}
            className="relative z-30 h-[640px] w-full"
          >
            {/* Halo derrière le canvas */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-cyan-400/10 blur-3xl"
            />
            {/* Cercles lumineux qui tournent (vibe arène) */}
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

            {/* Petite signature 3D en bas */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.35em] text-white/30">
              Trionda · Adidas · 2026
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════
         RECAP — Trois cartes inspirées de la section ExperienceSection
         ═════════════════════════════════════════════════════════════════ */}
      <section className="relative border-y border-white/5 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 py-20">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-300/40 to-transparent"
        />

        <div className="mx-auto max-w-7xl px-6">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mb-10 text-center text-xs font-semibold uppercase tracking-[0.4em] text-white/30"
          >
            ── Aperçu rapide ──
          </motion.p>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Trophy, label: "Finale", value: "14 juin", sub: "FRA vs BRA" },
              { icon: Ticket, label: "Zones", value: "4", sub: "VIP → Populaire" },
              { icon: Clock, label: "Sessions", value: "15 min", sub: "TTL backend" },
            ].map((q, i) => {
              const Icon = q.icon;
              return (
                <motion.div
                  key={q.label}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, delay: i * 0.1, ease: EASE }}
                  whileHover={{ y: -4 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-navy-800/40 p-6 backdrop-blur-sm transition-colors hover:border-cyan-400/40"
                >
                  <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-400/0 blur-2xl transition-all duration-500 group-hover:bg-cyan-400/15" />
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20">
                    <Icon size={18} aria-hidden />
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                    {q.label}
                  </p>
                  <p className="mt-1 heading-display text-4xl">{q.value}</p>
                  <p className="text-sm text-white/50">{q.sub}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════
         CTA bas
         ═════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE }}
            className="heading-display text-[clamp(2.4rem,5vw,4rem)] leading-[0.95]"
          >
            Pas encore de{" "}
            <span className="bg-gradient-to-r from-cyan-300 to-gold-300 bg-clip-text text-transparent">
              ticket
            </span>{" "}
            ?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-5 text-lg text-white/60"
          >
            64 matchs t'attendent. Le coup d'envoi est dans quelques semaines.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/matches">
              <Button size="lg" className="group">
                <CalendarDays size={18} aria-hidden />
                Voir les affiches
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
