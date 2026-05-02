"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  Activity,
  Box,
  Layers,
  Database,
  Server,
  Users,
  CreditCard,
  Armchair,
  ChevronDown,
  ChevronRight,
  Circle,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

interface ZoneStatus {
  zone: string;
  totalSeats: number;
  freeSeats: number;
  reservedSeats: number;
  confirmedSeats: number;
  lockedSeats: number;
  seatActorCount: number;
}

interface MatchManagerStatus {
  matchId: string;
  zones: Record<string, ZoneStatus>;
}

interface ActorStatus {
  matchManagers: Record<string, MatchManagerStatus>;
  reservationHandlerReservations: number;
  paymentGatewayPending: number;
  totalSeatActors: number;
  totalZoneManagers: number;
  sessionManagerActive: boolean;
  seatAllocatorActive: boolean;
  reservationHandlerActive: boolean;
  paymentGatewayActive: boolean;
}

interface MonitorMessage {
  type: "status_update" | "error";
  timestamp: number;
  latencyMs: number;
  data?: ActorStatus;
  error?: string;
}

export function AdminScalaMonitor({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<ActorStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://localhost:8080/ws/admin/monitor");

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const msg: MonitorMessage = JSON.parse(event.data);
        if (msg.type === "status_update" && msg.data) {
          setStatus(msg.data);
          setLatency(msg.latencyMs);
          setError(null);
        } else if (msg.type === "error") {
          setError(msg.error || "WebSocket error");
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2s
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 2000);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setConnected(false);
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const toggleMatch = (id: string) => {
    setExpandedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!status && !error) {
    return (
      <div className="flex items-center justify-center py-24 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <span className="text-white/50 text-sm">Connecting to actor system...</span>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-10 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={connect}
          className="mt-4 px-4 py-2 rounded-lg bg-red-400/10 text-red-400 text-sm hover:bg-red-400/20 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!status) return null;

  const topLevelActors = [
    {
      name: "SessionManager",
      active: status.sessionManagerActive,
      icon: Users,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      name: "SeatAllocator",
      active: status.seatAllocatorActive,
      icon: Armchair,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      name: "ReservationHandler",
      active: status.reservationHandlerActive,
      icon: Box,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
    },
    {
      name: "PaymentGateway",
      active: status.paymentGatewayActive,
      icon: CreditCard,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Connection Status Bar */}
      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          {connected ? (
            <Wifi size={16} className="text-emerald-400" />
          ) : (
            <WifiOff size={16} className="text-red-400" />
          )}
          <span className={`text-sm font-medium ${connected ? "text-emerald-400" : "text-red-400"}`}>
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/30 font-mono">
          <span className="flex items-center gap-1.5">
            <Zap size={12} className="text-amber-400" />
            {latency}ms
          </span>
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            label: "Match Managers",
            value: Object.keys(status.matchManagers).length,
            sub: "Active Matches",
            icon: Layers,
            color: "text-violet-400",
            bg: "bg-violet-400/10",
          },
          {
            label: "Zone Managers",
            value: status.totalZoneManagers,
            sub: "Active Zones",
            icon: Database,
            color: "text-pink-400",
            bg: "bg-pink-400/10",
          },
          {
            label: "Seat Actors",
            value: status.totalSeatActors,
            sub: "Active Seats",
            icon: Armchair,
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
          },
          {
            label: "Reservations",
            value: status.reservationHandlerReservations,
            sub: "Active",
            icon: Activity,
            color: "text-amber-400",
            bg: "bg-amber-400/10",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl border border-white/10 bg-navy-900/60 p-6 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <span className="text-sm font-medium text-white/50 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="heading-display text-4xl text-white">{stat.value}</span>
              <span className="text-xs text-white/30">{stat.sub}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Top-Level Actors Status */}
      <div className="rounded-2xl border border-white/10 bg-navy-900/60 overflow-hidden backdrop-blur-sm">
        <div className="border-b border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <Server size={20} className="text-cyan-400" />
          <h3 className="font-semibold text-white">Top-Level Actors</h3>
        </div>
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topLevelActors.map((actor) => (
              <div
                key={actor.name}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-4"
              >
                <div className={`p-2 rounded-lg ${actor.bg} ${actor.color}`}>
                  <actor.icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{actor.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Circle
                      size={8}
                      className={actor.active ? "text-emerald-400 fill-emerald-400" : "text-red-400 fill-red-400"}
                    />
                    <span className={`text-xs ${actor.active ? "text-emerald-400" : "text-red-400"}`}>
                      {actor.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actor Hierarchy */}
      <div className="rounded-2xl border border-white/10 bg-navy-900/60 overflow-hidden backdrop-blur-sm">
        <div className="border-b border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <Cpu size={20} className="text-cyan-400" />
          <h3 className="font-semibold text-white">Actor Hierarchy</h3>
          <span className="ml-auto text-xs text-white/30 font-mono">
            {Object.keys(status.matchManagers).length} MatchManagers · {status.totalZoneManagers} ZoneManagers · {status.totalSeatActors} SeatActors
          </span>
        </div>
        <div className="p-4 space-y-2">
          {/* Supervisor */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <Server size={16} className="text-cyan-400" />
            <span className="font-mono text-sm text-white font-semibold">Supervisor</span>
          </div>

          {/* MatchManagers */}
          {Object.entries(status.matchManagers).map(([id, mm]) => (
            <div key={id} className="ml-6 space-y-2">
              <button
                onClick={() => toggleMatch(id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                {expandedMatches.has(id) ? (
                  <ChevronDown size={16} className="text-white/40" />
                ) : (
                  <ChevronRight size={16} className="text-white/40" />
                )}
                <div className="h-2 w-2 rounded-full bg-violet-400" />
                <Layers size={16} className="text-violet-400" />
                <span className="font-mono text-sm text-white/70">MatchManager: {mm.matchId}</span>
                <span className="ml-auto text-xs text-white/30 font-mono">
                  {Object.keys(mm.zones).length} zones · {Object.values(mm.zones).reduce((sum, z) => sum + z.seatActorCount, 0)} seats
                </span>
              </button>

              <AnimatePresence>
                {expandedMatches.has(id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-6 overflow-hidden"
                  >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {Object.entries(mm.zones).map(([zoneName, z]) => (
                        <div
                          key={zoneName}
                          className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-3"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-wider text-white/40">
                              {zoneName}
                            </span>
                            <span className="text-[10px] font-mono text-white/20">
                              {z.seatActorCount} SeatActors
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              <span className="text-[11px] text-white/60">
                                Free: <b className="text-white">{z.freeSeats}</b>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              <span className="text-[11px] text-white/60">
                                Res: <b className="text-white">{z.reservedSeats}</b>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              <span className="text-[11px] text-white/60">
                                Conf: <b className="text-white">{z.confirmedSeats}</b>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                              <span className="text-[11px] text-white/60">
                                Lock: <b className="text-white">{z.lockedSeats}</b>
                              </span>
                            </div>
                          </div>

                          {/* Mini bar chart */}
                          <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5">
                            {z.totalSeats > 0 && (
                              <>
                                <div
                                  className="bg-emerald-400"
                                  style={{ width: `${(z.freeSeats / z.totalSeats) * 100}%` }}
                                />
                                <div
                                  className="bg-amber-400"
                                  style={{ width: `${(z.reservedSeats / z.totalSeats) * 100}%` }}
                                />
                                <div
                                  className="bg-red-400"
                                  style={{ width: `${(z.confirmedSeats / z.totalSeats) * 100}%` }}
                                />
                                <div
                                  className="bg-purple-400"
                                  style={{ width: `${(z.lockedSeats / z.totalSeats) * 100}%` }}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {Object.keys(status.matchManagers).length === 0 && (
            <div className="text-center py-12 text-white/30 italic">
              No active MatchManagers found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
