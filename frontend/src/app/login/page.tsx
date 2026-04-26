"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api";
import { setSession } from "@/lib/session";

const EASE = [0.22, 1, 0.36, 1] as const;
type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => setError(null);

  async function onSubmitLogin(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (!username.trim() || !password) { setError("Pseudo et mot de passe requis"); return; }
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      setSession({ sessionId: res.session_id, clientId: res.client_id, username: res.username, isAdmin: res.is_admin });
      router.push("/matches");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Pseudo ou mot de passe incorrect" : "Erreur réseau");
    } finally { setLoading(false); }
  }

  async function onSubmitRegister(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (!username.trim() || password.length < 6 || !email.trim() || !name.trim()) {
      setError("Tous les champs sont requis. Mot de passe : 6 caractères mini.");
      return;
    }
    setLoading(true);
    try {
      await api.register(username.trim(), password, email.trim(), name.trim());
      const res = await api.login(username.trim(), password);
      setSession({ sessionId: res.session_id, clientId: res.client_id, username: res.username, isAdmin: res.is_admin });
      router.push("/matches");
    } catch (err) {
      if (err instanceof ApiError) {
        const reason = (err.body as { error?: string })?.error;
        if (reason === "username_or_email_taken") setError("Ce pseudo ou email est déjà utilisé");
        else if (reason === "invalid_input") setError("Champs invalides");
        else setError(`Échec inscription (${err.status})`);
      } else setError("Erreur réseau");
    } finally { setLoading(false); }
  }

  const isLogin = mode === "login";

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#03060c] text-white">
      {/* ── Cinematic backdrop ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 30% 40%, #0e2547 0%, transparent 55%), radial-gradient(ellipse 70% 60% at 80% 80%, #2a1810 0%, transparent 60%), #03060c' }} />
        <motion.div
          className="absolute -top-40 left-[15%] h-[640px] w-[640px] rounded-full blur-[150px]"
          style={{ background: 'radial-gradient(circle, #22d3ee 0%, transparent 65%)', mixBlendMode: 'screen', opacity: 0.55 }}
          animate={{ x: [0, 60, -30, 0], y: [0, 40, -20, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-12%] right-[10%] h-[600px] w-[600px] rounded-full blur-[160px]"
          style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 60%)', mixBlendMode: 'screen', opacity: 0.4 }}
          animate={{ x: [0, -50, 30, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 32, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(rgba(186,230,253,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(186,230,253,0.6) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
            maskImage: 'radial-gradient(ellipse at 50% 50%, black 30%, transparent 90%)',
          }}
        />
        {/* Vertical scan line accent (editorial vibe) */}
        <div className="absolute inset-y-0 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-cyan-400/15 to-transparent lg:block" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1480px] grid-cols-1 lg:grid-cols-12">

        {/* ═══ LEFT — editorial hero ═══════════════════════════════════ */}
        <section className="relative flex flex-col justify-between px-6 py-10 lg:col-span-7 lg:px-14 lg:py-16">
          {/* TOP : eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/55">
              <span className="h-px w-8 bg-cyan-400/60" />
              CyStadium · Édition 2026
            </div>
          </motion.div>

          {/* CENTER : cup + headline composition */}
          <div className="relative my-12 lg:my-0">
            {/* The cup, dramatically positioned */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE, delay: 0.15 }}
              className="pointer-events-none absolute -top-10 right-0 z-0 hidden lg:block"
            >
              <div className="relative">
                {/* Glow halo behind */}
                <div aria-hidden className="absolute inset-0 -z-10 scale-110 blur-3xl">
                  <div className="h-full w-full rounded-full bg-gradient-to-br from-cyan-400/40 via-fuchsia-500/15 to-amber-300/40" />
                </div>
                <Image
                  src="/wc2026.png"
                  alt="Coupe du Monde FIFA 2026"
                  width={520}
                  height={802}
                  priority
                  className="h-[520px] w-auto drop-shadow-[0_25px_60px_rgba(34,211,238,0.35)]"
                  style={{ mixBlendMode: "screen", filter: "saturate(1.15) contrast(1.05)" }}
                />
                {/* Subtle floating dot */}
                <motion.div
                  aria-hidden
                  className="absolute right-12 top-24 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_20px_4px_rgba(34,211,238,0.6)]"
                  animate={{ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>

            {/* Headline */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.08 } } }}
              className="relative z-10 max-w-2xl"
            >
              <Line>
                <span className="font-display text-[clamp(2.8rem,7vw,6.5rem)] leading-[0.92] tracking-tight">
                  La Coupe<br />du Monde
                </span>
              </Line>
              <Line>
                <span className="mt-1 block font-display text-[clamp(2.8rem,7vw,6.5rem)] leading-[0.92] tracking-tight">
                  <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-amber-300 bg-clip-text text-transparent">
                    sans la file d&apos;attente.
                  </span>
                </span>
              </Line>
              <Line>
                <p className="mt-7 max-w-md text-base leading-relaxed text-white/65 lg:text-lg">
                  Plan interactif, places verrouillées en temps réel.
                  <br />Le stade, en trois clics.
                </p>
              </Line>
            </motion.div>

            {/* Mobile cup (below text on small screens) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
              className="mt-8 flex justify-center lg:hidden"
            >
              <div className="relative">
                <div aria-hidden className="absolute inset-0 -z-10 blur-3xl">
                  <div className="h-full w-full rounded-full bg-gradient-to-br from-cyan-400/30 via-fuchsia-400/10 to-amber-300/30" />
                </div>
                <Image
                  src="/wc2026.png"
                  alt=""
                  width={300} height={462}
                  className="h-[260px] w-auto"
                  style={{ mixBlendMode: "screen" }}
                />
              </div>
            </motion.div>
          </div>

          {/* BOTTOM : meta strip with stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
            className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm"
          >
            {[
              { kpi: "64",          label: "matchs" },
              { kpi: "32",          label: "nations" },
              { kpi: "11/06",       label: "coup d'envoi"},
            ].map(({ kpi, label}) => (
              <div key={label} className="bg-black/30 px-5 py-4">
                <div className="font-display text-2xl text-white sm:text-3xl">{kpi}</div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">{label}</div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ═══ RIGHT — auth panel ════════════════════════════════════ */}
        <aside className="relative flex items-center px-6 py-12 lg:col-span-5 lg:px-10 lg:py-16 xl:px-14">
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
            className="relative w-full"
          >
            {/* Floating brand mark — FIFA badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
              className="absolute -top-2 right-4 z-10 hidden lg:block"
            >
              <div className="flex h-12 w-28 rotate-12 overflow-hidden rounded-full border border-white/10 bg-black/40 shadow-lg shadow-black/40 backdrop-blur-md">
                <Image src="/fifa-badge.jpeg" alt="" width={112} height={48} className="h-full w-full object-cover" style={{ mixBlendMode: "screen" }} />
              </div>
            </motion.div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-7 backdrop-blur-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] sm:p-9">
              {/* gradient ring */}
              <div aria-hidden className="absolute inset-0 rounded-[28px] [background:linear-gradient(140deg,rgba(34,211,238,0.25),transparent_30%,transparent_70%,rgba(251,191,36,0.18))] [mask:linear-gradient(black,black)_content-box,linear-gradient(black,black)] [mask-composite:exclude] p-px" />

              <div className="relative">
                <div className="mb-8">
                  <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-300/80">
                    {isLogin ? "— Connexion" : "— Inscription"}
                  </div>
                  <h2 className="mt-2 font-display text-4xl leading-tight tracking-tight">
                    {isLogin ? <>Bon retour.</> : <>Tout commence<br/>maintenant.</>}
                  </h2>
                  <p className="mt-2.5 text-sm text-white/55">
                    {isLogin
                      ? "Accède à tes places en un clic."
                      : "Pas d'email à valider, pas de paperasse."}
                  </p>
                </div>

                {/* Segmented switch */}
                <div role="tablist" className="mb-7 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/40 p-1">
                  {(["login", "register"] as const).map((m) => {
                    const active = mode === m;
                    return (
                      <button
                        key={m}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        onClick={() => { setMode(m); reset(); }}
                        className={`relative rounded-full px-3 py-2 text-sm font-medium transition-colors ${active ? "text-[#03060c]" : "text-white/55 hover:text-white"}`}
                      >
                        {active && (
                          <motion.span
                            layoutId="auth-pill-v2"
                            className="absolute inset-0 rounded-full bg-cyan-300 shadow-[0_8px_30px_-8px_rgba(34,211,238,0.7)]"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}
                        <span className="relative">{m === "login" ? "Connexion" : "Inscription"}</span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  {isLogin ? (
                    <motion.form
                      key="login"
                      onSubmit={onSubmitLogin}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="space-y-4"
                    >
                      <Input
                        label="Pseudo"
                        placeholder="zidane10"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        spellCheck={false}
                      />
                      <PasswordField
                        label="Mot de passe"
                        placeholder="Ton mot de passe"
                        value={password}
                        onChange={setPassword}
                        show={showPassword}
                        onToggleShow={() => setShowPassword(s => !s)}
                        error={error}
                        autoComplete="current-password"
                      />
                      <Button type="submit" size="lg" className="group mt-3 w-full" disabled={loading}>
                        {loading ? "Connexion..." : "Entrer dans le stade"}
                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Button>
                      <p className="pt-1 text-center text-xs text-white/45">
                        Pas encore de compte ?{" "}
                        <button type="button" onClick={() => { setMode("register"); reset(); }} className="font-medium text-cyan-300 hover:underline">
                          Créer mon compte
                        </button>
                      </p>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="register"
                      onSubmit={onSubmitRegister}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="space-y-4"
                    >
                      <Input
                        label="Pseudo"
                        placeholder="champion26"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        spellCheck={false}
                        helper="3 à 40 caractères, unique."
                      />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nom complet" placeholder="Léa Martin" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                        <Input label="Email" type="email" placeholder="lea@gmail.fr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                      </div>
                      <PasswordField
                        label="Mot de passe"
                        placeholder="Au moins 6 caractères"
                        value={password}
                        onChange={setPassword}
                        show={showPassword}
                        onToggleShow={() => setShowPassword(s => !s)}
                        error={error}
                        autoComplete="new-password"
                      />
                      <Button type="submit" size="lg" className="group mt-3 w-full" disabled={loading}>
                        {loading ? "Création..." : "Réserver ma place"}
                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Button>
                      <p className="pt-1 text-center text-xs text-white/45">
                        Déjà un compte ?{" "}
                        <button type="button" onClick={() => { setMode("login"); reset(); }} className="font-medium text-cyan-300 hover:underline">
                          Se connecter
                        </button>
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer micro-line */}
            <div className="mt-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">
              <span>World Cup · 2026</span>
              <span>cy-tech</span>
            </div>
          </motion.div>
        </aside>
      </div>
    </div>
  );
}

// Stagger child wrapper
function Line({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

// Password input with show/hide
function PasswordField({
  label, placeholder, value, onChange, show, onToggleShow, error, autoComplete,
}: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void; error: string | null; autoComplete: string;
}) {
  return (
    <div className="relative">
      <Input
        label={label}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error ?? undefined}
        autoComplete={autoComplete}
        className="pr-11"
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute right-3 top-[34px] inline-flex h-8 w-8 items-center justify-center rounded-md text-white/45 transition-colors hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
