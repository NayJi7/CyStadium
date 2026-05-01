"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Ticket, ScrollText, Users, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/session";
import { AuroraBackground } from "@/components/AuroraBackground";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminMatches } from "@/components/admin/AdminMatches";
import { AdminReservations } from "@/components/admin/AdminReservations";
import { AdminUsers } from "@/components/admin/AdminUsers";

const EASE = [0.22, 1, 0.36, 1] as const;

const TABS = [
  { id: "dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { id: "matches",      label: "Matchs",        icon: Ticket },
  { id: "reservations", label: "Réservations",  icon: ScrollText },
  { id: "users",        label: "Utilisateurs",  icon: Users },
] as const;

type TabId = typeof TABS[number]["id"];
type AuthState = "loading" | "unauthenticated" | "forbidden" | "ready";

export default function AdminPage() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  useEffect(() => {
    const session = getSession();
    if (!session) { setAuthState("unauthenticated"); return; }
    setSessionId(session.sessionId);
    api.me(session.sessionId)
      .then(({ is_admin }) => setAuthState(is_admin ? "ready" : "forbidden"))
      .catch(() => setAuthState("unauthenticated"));
  }, []);

  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <div className="mx-auto max-w-7xl px-6 py-12">

        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-10"
        >
          <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/50">
            <span className="h-px w-10 bg-cyan-400/70" />
            <span className="font-mono">Back-office</span>
          </div>
          <h1 className="heading-display text-[clamp(2.5rem,6vw,5rem)] leading-[0.92]">
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-gold-300 bg-clip-text text-transparent">
              Admin
            </span>{" "}
            · CyStadium
          </h1>
        </motion.header>

        {authState === "loading" && (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          </div>
        )}

        {authState === "unauthenticated" && (
          <div className="rounded-2xl border border-gold-300/20 bg-gold-300/5 p-10 text-center">
            <ShieldAlert size={40} className="mx-auto mb-3 text-gold-300/50" />
            <p className="text-lg text-white/70">Connectez-vous pour accéder au back-office.</p>
          </div>
        )}

        {authState === "forbidden" && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-10 text-center">
            <ShieldAlert size={40} className="mx-auto mb-3 text-red-400/50" />
            <p className="text-lg text-white/70">Accès refusé. Compte admin requis.</p>
          </div>
        )}

        {authState === "ready" && sessionId && (
          <>
            <div className="mb-8 flex w-fit gap-1 rounded-xl border border-white/10 bg-navy-900/60 p-1">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === tab.id
                        ? "bg-cyan-400 text-navy-950"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    <Icon size={15} aria-hidden />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {activeTab === "dashboard"    && <AdminDashboard    sessionId={sessionId} />}
              {activeTab === "matches"      && <AdminMatches      sessionId={sessionId} />}
              {activeTab === "reservations" && <AdminReservations sessionId={sessionId} />}
              {activeTab === "users"        && <AdminUsers        sessionId={sessionId} />}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
