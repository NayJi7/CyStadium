"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api";
import { setSessionId } from "@/lib/session";
import { AuroraBackground } from "@/components/AuroraBackground";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LoginPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRe.test(clientId.trim())) {
      setError("client_id doit être un UUID valide");
      return;
    }

    setLoading(true);
    try {
      const { session_id } = await api.login(clientId.trim());
      setSessionId(session_id);
      router.push("/matches");
    } catch (err) {
      setError(err instanceof ApiError ? `Échec (${err.status})` : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  function generateUuid() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      setClientId(crypto.randomUUID());
    }
  }

  return (
    <div className="relative">
      <AuroraBackground />

      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-md items-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="w-full rounded-3xl border border-white/10 bg-navy-800/50 p-8 backdrop-blur-xl md:p-10"
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20">
              <LogIn size={24} aria-hidden />
            </div>
            <h1 className="heading-display text-5xl">
              Se <span className="text-cyan-400">connecter</span>
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Utilise ton <code className="text-cyan-300">client_id</code> pour
              ouvrir une session 15 min.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <Input
              label="Client ID (UUID)"
              placeholder="550e8400-e29b-41d4-a716-446655440000"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              error={error}
              helper="UUID v4. Le backend valide et ouvre la session."
              autoComplete="off"
              spellCheck={false}
            />

            <div className="flex items-center gap-3">
              <Button type="submit" size="lg" className="flex-1 group" disabled={loading}>
                <LogIn size={18} aria-hidden />
                {loading ? "Connexion..." : "Se connecter"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={generateUuid}
                disabled={loading}
                title="Générer un UUID aléatoire"
              >
                <Sparkles size={16} />
                Aléatoire
              </Button>
            </div>
          </form>

          <p className="mt-8 text-center text-xs text-white/40">
            Projet CY Tech · authentification sans base utilisateur (démo)
          </p>
        </motion.div>
      </div>
    </div>
  );
}
