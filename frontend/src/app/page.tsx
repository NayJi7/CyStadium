"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import { ReactLenis } from "lenis/react";
import {
  ArrowRight,
  Radio,
  ShieldCheck,
  Zap,
  Ticket,
  Globe2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuroraBackground } from "@/components/AuroraBackground";
import { CountUp } from "@/components/CountUp";
import { MatchTicker } from "@/components/MatchTicker";
import { FloatingTrophy } from "@/components/FloatingTrophy";

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

/* ═══════════════════════════════════════════════════════════════════════════
   LANDING, Lenis smooth scroll + GSAP ScrollTrigger-driven 3D trophy
   ═══════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <ReactLenis root options={{ lerp: 0.09, duration: 1.2, smoothWheel: true }}>
      <LandingContent />
    </ReactLenis>
  );
}

function LandingContent() {
  return (
    <div className="relative overflow-x-clip">
      <ScrollProgress />
      <FloatingTrophy />
      <HeroSection />
      <MatchTicker />
      <ExperienceSection />
      <StatsSection />
      <StadiumSection />
      <FinalCtaSection />
    </div>
  );
}

/* ─── Scroll progress bar (cyan, en haut) ─── */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <motion.div
      aria-hidden
      style={{ scaleX, transformOrigin: "left" }}
      className="fixed inset-x-0 top-0 z-50 h-[2px] bg-gradient-to-r from-cyan-400 via-gold-300 to-cyan-400"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO, Big left-aligned statement, trophée à droite
   ═══════════════════════════════════════════════════════════════════════════ */
function HeroSection() {
  const headline = "Secure your seat.";
  const words = headline.split(" ");

  return (
    <section className="relative overflow-hidden">
      <AuroraBackground />

      {/* Fine grille en fond */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 30% 50%, black 40%, transparent 75%)",
        }}
      />

      <div className="mx-auto grid min-h-[94vh] max-w-7xl grid-cols-1 items-center gap-12 px-6 py-20 md:grid-cols-[1.15fr_1fr] md:py-24">
        <motion.div
          className="relative z-10 space-y-8"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
        >
          <motion.div
            variants={fadeUp}
            className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/50"
          >
            <span className="h-px w-10 bg-cyan-400/70" />
            <span className="font-mono">Coupe du Monde · 2026</span>
          </motion.div>

          {/* Headline avec reveal mot par mot */}
          <h1 className="heading-display text-[clamp(3.2rem,8.2vw,7rem)] leading-[0.92]">
            <span className="block">
              {words.map((w, i) => (
                <motion.span
                  key={i}
                  className="mr-[0.25em] inline-block"
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: EASE }}
                >
                  {w}
                </motion.span>
              ))}
            </span>
            <span className="relative inline-block">
              <motion.span
                className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-gold-300 bg-clip-text text-transparent"
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
              >
                Instantly.
              </motion.span>
              <motion.span
                aria-hidden
                className="absolute -inset-x-2 inset-y-0 -z-10 rounded-lg bg-cyan-400/10 blur-2xl"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </span>
          </h1>

          <motion.p variants={fadeUp} className="max-w-xl text-lg text-white/70">
            La billetterie officielle CyStadium. Acteurs Akka, vérification formelle
            par réseau de Pétri, WebSocket temps réel.{" "}
            <span className="text-white">Zéro surbooking, prouvé, pas promis.</span>
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-4">
            <Link href="/matches">
              <Button size="lg" className="group">
                Voir les matchs
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Se connecter
              </Button>
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="flex items-center gap-5 pt-2 text-xs text-white/40"
          >
            <div className="flex -space-x-2">
              {["from-cyan-400 to-cyan-600", "from-gold-300 to-gold-500", "from-indigo-400 to-indigo-600"].map((c, i) => (
                <div
                  key={i}
                  className={`h-7 w-7 rounded-full border-2 border-navy-900 bg-gradient-to-br ${c}`}
                />
              ))}
            </div>
            <span>
              Déjà <strong className="font-semibold text-white/70">27 340</strong> réservations sécurisées
            </span>
          </motion.div>
        </motion.div>

        {/* Colonne droite : espace réservé pour le trophée */}
        <div aria-hidden className="hidden h-[62vh] md:block" />
      </div>

      {/* Scroll hint */}
      <motion.div
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/40"
        animate={{ y: [0, 8, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        Scroll ↓
      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPÉRIENCE, Trophée à gauche, contenu calé à droite
   ═══════════════════════════════════════════════════════════════════════════ */
const FEATURES = [
  {
    num: "01",
    icon: Zap,
    title: "Réservation atomique",
    desc: "Acteurs Akka + réseau de Pétri. Tout-ou-rien garanti, zéro surbooking même à 10 000 requêtes par seconde.",
  },
  {
    num: "02",
    icon: Radio,
    title: "Temps réel WebSocket",
    desc: "Chaque siège change d'état en direct sous vos yeux. Libre, verrouillé, confirmé, sans refresh.",
  },
  {
    num: "03",
    icon: ShieldCheck,
    title: "Paiement avec rollback",
    desc: "Session éphémère signée, paiement simulé. Si le paiement échoue, les places sont libérées instantanément.",
  },
];

function ExperienceSection() {
  return (
    <section className="relative overflow-hidden py-28 md:py-40">
      {/* Dégradé horizontal qui renforce le côté gauche (vide, trophée) */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-cyan-400/[0.04] via-transparent to-transparent"
      />

      <div className="mx-auto max-w-7xl px-6">
        {/* Contenu calé à droite pour laisser la gauche au trophée */}
        <div className="md:ml-auto md:w-[58%]">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
              L'expérience · 03 promesses
            </p>
            <h2 className="heading-display text-[clamp(3rem,6vw,5.5rem)] leading-[0.95]">
              Trois promesses.
              <br />
              <span className="bg-gradient-to-r from-cyan-300 to-gold-300 bg-clip-text text-transparent">
                Tenues.
              </span>
            </h2>
            <p className="mt-6 max-w-xl text-lg text-white/60">
              Du clic au ticket : tout a été pensé pour que vous n'ayez rien à penser.
            </p>
          </motion.div>

          {/* 3 cartes empilées, on reste sur la moitié droite */}
          <div className="mt-14 space-y-5">
            {FEATURES.map(({ num, icon: Icon, title, desc }, i) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: EASE }}
                whileHover={{ x: -6, transition: { duration: 0.25 } }}
                className="group relative flex items-start gap-6 overflow-hidden rounded-2xl border border-white/10 bg-navy-800/40 p-7 backdrop-blur-sm transition-colors duration-300 hover:border-cyan-400/40"
              >
                <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/0 blur-3xl transition-all duration-500 group-hover:bg-cyan-400/15" />

                <span className="heading-display text-5xl text-white/10 tabular-nums transition-colors group-hover:text-cyan-400/30">
                  {num}
                </span>

                <div className="flex-1">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20 transition-transform duration-300 group-hover:scale-110">
                      <Icon size={18} strokeWidth={2} aria-hidden />
                    </div>
                    <h3 className="heading-display text-2xl">{title}</h3>
                  </div>
                  <p className="text-white/60 leading-relaxed">{desc}</p>
                </div>

                <ArrowRight
                  size={18}
                  className="mt-3 shrink-0 text-white/20 transition-all duration-300 group-hover:translate-x-1 group-hover:text-cyan-300"
                  aria-hidden
                />
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATS, Bande horizontale
   ═══════════════════════════════════════════════════════════════════════════ */
const STATS = [
  { value: 64,     suffix: "",   label: "Matchs",             decimals: undefined as number | undefined },
  { value: 16,     suffix: "",   label: "Stades hôtes",       decimals: undefined as number | undefined },
  { value: 10000,  suffix: "+",  label: "Sièges temps réel",  decimals: undefined as number | undefined },
  { value: 99.99,  suffix: " %", label: "Cohérence prouvée",  decimals: 2 },
];

function StatsSection() {
  return (
    <section className="relative border-y border-white/5 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 py-24">
      {/* Lignes lumineuses horizontales */}
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
          className="mb-12 text-center text-xs font-semibold uppercase tracking-[0.4em] text-white/30"
        >
          ── Chiffres clés ──
        </motion.p>

        <div className="grid gap-10 md:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
              className="text-center"
            >
              <div className="heading-display text-5xl md:text-6xl text-transparent bg-gradient-to-br from-white via-cyan-200 to-cyan-400 bg-clip-text tabular-nums">
                <CountUp
                  to={s.value}
                  format={(v) =>
                    s.decimals
                      ? v.toLocaleString("fr-FR", {
                          minimumFractionDigits: s.decimals,
                          maximumFractionDigits: s.decimals,
                        })
                      : Math.round(v).toLocaleString("fr-FR")
                  }
                />
                <span className="text-gold-300">{s.suffix}</span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/40">
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STADE, Texte à gauche, image à droite
   ═══════════════════════════════════════════════════════════════════════════ */
function StadiumSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["10%", "-10%"]);

  return (
    <section ref={ref} className="relative overflow-hidden py-28 md:py-36">
      {/* Image panoramique en fond avec parallax */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 -z-10">
        <Image
          src="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1920&q=70"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950 via-navy-900/60 to-navy-950" />
      </motion.div>

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 md:grid-cols-[1fr_1.1fr]">
        {/* Texte, gauche, parallax léger */}
        <motion.div style={{ y: textY }} className="relative z-20 space-y-6">
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE }}
            className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400"
          >
            64 matchs · 16 stades · 1 trophée
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
            className="heading-display text-[clamp(2.8rem,5.5vw,5rem)] leading-[0.95]"
          >
            Des tribunes
            <br />
            <span className="bg-gradient-to-r from-cyan-300 to-gold-300 bg-clip-text text-transparent">
              légendaires
            </span>
            ,
            <br />
            à portée de clic.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
            className="max-w-lg text-lg text-white/70"
          >
            Du Stade de France à l'Allianz Arena, de Wembley au Maracanã.
            Chaque zone, chaque siège, chaque instant, cartographié, réservé,
            sécurisé.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
            className="flex flex-wrap gap-3 pt-2"
          >
            {["VIP", "Or", "Standard", "Populaire"].map((z) => (
              <span
                key={z}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/60 px-4 py-1.5 text-sm backdrop-blur-sm"
              >
                <Ticket size={14} className="text-cyan-400" aria-hidden />
                {z}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Image card, droite */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: EASE }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-glow-lg">
            <Image
              src="https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&q=75"
              alt="Stade"
              width={1200}
              height={800}
              className="h-[480px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/20 to-transparent" />

            {/* Chips info */}
            <div className="absolute inset-x-5 bottom-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 rounded-full bg-navy-950/70 px-3 py-1.5 text-xs backdrop-blur-md">
                <Globe2 size={14} className="text-cyan-400" aria-hidden />
                Stade de France · Saint-Denis
              </div>
              <div className="flex items-center gap-2 rounded-full bg-navy-950/70 px-3 py-1.5 text-xs backdrop-blur-md">
                <Users size={14} className="text-cyan-400" aria-hidden />
                80 698 places
              </div>
            </div>

            {/* Badge live */}
            <div className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CTA FINAL
   ═══════════════════════════════════════════════════════════════════════════ */
function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden py-32 md:py-40">
      <AuroraBackground />

      {/* Cercles concentriques en fond (vibe "arène") */}
      <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/10"
            style={{ width: `${320 + i * 180}px`, height: `${320 + i * 180}px` }}
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 40 + i * 8, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      <div className="relative z-40 mx-auto max-w-3xl px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mb-6 text-xs font-semibold uppercase tracking-[0.4em] text-cyan-400"
        >
          Coup d'envoi · 14 juin 2026
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          className="heading-display text-[clamp(3rem,8vw,7rem)] leading-[0.9]"
        >
          Prêt à{" "}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-gold-300 bg-clip-text text-transparent">
              réserver
            </span>
            <motion.span
              aria-hidden
              className="absolute -inset-x-3 inset-y-0 -z-10 rounded-xl bg-cyan-400/10 blur-2xl"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </span>{" "}
          ?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-8 max-w-2xl text-lg text-white/70"
        >
          64 matchs. 10 000 sièges. Un clic pour sécuriser le vôtre, avant tout
          le monde.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
          className="mt-12 flex flex-wrap items-center justify-center gap-4"
        >
          <Link href="/matches">
            <Button size="lg" className="group">
              Explorer les matchs
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              J'ai déjà un compte
            </Button>
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-16 text-[10px] uppercase tracking-[0.35em] text-white/30"
        >
          CyStadium · Projet CY Tech · Akka · Next.js · WebSocket
        </motion.p>
      </div>
    </section>
  );
}