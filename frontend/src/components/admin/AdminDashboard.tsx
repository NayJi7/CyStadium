"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Ticket, Users, BarChart2 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { api, type AdminStats } from "@/lib/api";

const EASE = [0.22, 1, 0.36, 1] as const;
const PERIODS = [
  { value: "7d",  label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "all", label: "Tout" },
] as const;

const PIE_COLORS = ["#22d3ee","#fbbf24","#a78bfa","#34d399","#f87171","#94a3b8"];

type Period = typeof PERIODS[number]["value"];

export function AdminDashboard({ sessionId }: { sessionId: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.adminStats(sessionId, period)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [sessionId, period]);

  const kpiCards = stats ? [
    { label: "Revenus totaux", value: `${stats.kpis.total_revenue.toLocaleString("fr-FR")} €`, icon: TrendingUp, tint: "from-cyan-400 to-cyan-600" },
    { label: "Réservations", value: stats.kpis.total_reservations.toLocaleString("fr-FR"), icon: Ticket, tint: "from-gold-300 to-gold-500" },
    { label: "Taux occupation", value: `${stats.kpis.avg_occupancy.toFixed(1)} %`, icon: BarChart2, tint: "from-violet-400 to-violet-600" },
    { label: "Places libres", value: stats.kpis.total_free_seats.toLocaleString("fr-FR"), icon: Users, tint: "from-emerald-400 to-emerald-600" },
  ] : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="heading-display text-2xl text-white/80">Vue d&apos;ensemble</h2>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-navy-900/60 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                period === p.value ? "bg-cyan-400 text-navy-950" : "text-white/50 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          [0,1,2,3].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/5 bg-navy-800/50" />
          ))
        ) : kpiCards.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-navy-800/50 p-5 backdrop-blur-sm hover:border-cyan-400/30"
            >
              <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${k.tint} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`} />
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/60">
                <Icon size={16} />
              </div>
              <div className="heading-display text-3xl text-white">{k.value}</div>
              <p className="mt-1 text-xs text-white/40">{k.label}</p>
            </motion.div>
          );
        })}
      </div>

      {stats && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-navy-800/50 p-6 backdrop-blur-sm">
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
              Réservations confirmées / jour
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.reservations_over_time}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0d1b2a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                  labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                  itemStyle={{ color: "#22d3ee" }}
                />
                <Area type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-navy-800/50 p-6 backdrop-blur-sm">
              <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Occupation par zone
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.occupancy_by_zone}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="zone" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0d1b2a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, color: "rgba(255,255,255,0.5)" }} />
                  <Bar dataKey="free" name="Libres" fill="#22d3ee" radius={[4,4,0,0]} />
                  <Bar dataKey="occupied" name="Occupées" fill="#fbbf24" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-white/10 bg-navy-800/50 p-6 backdrop-blur-sm">
              <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Revenus par match
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.revenue_by_match}
                    cx="50%" cy="50%"
                    outerRadius={80}
                    dataKey="revenue"
                    nameKey="match_name"
                    paddingAngle={3}
                  >
                    {stats.revenue_by_match.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0d1b2a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                    formatter={(v) => [`${Number(v).toLocaleString("fr-FR")} €`, ""]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}
                    formatter={(v: string) => v.length > 18 ? v.slice(0, 18) + "…" : v}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {loading && !stats && (
        <div className="space-y-4">
          <div className="h-56 animate-pulse rounded-2xl border border-white/5 bg-navy-800/50" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-56 animate-pulse rounded-2xl border border-white/5 bg-navy-800/50" />
            <div className="h-56 animate-pulse rounded-2xl border border-white/5 bg-navy-800/50" />
          </div>
        </div>
      )}
    </div>
  );
}
