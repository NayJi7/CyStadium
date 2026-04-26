"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import { Flag } from "@/components/Flag";
import { findMatch } from "@/lib/matches";
import { ZoneSelector, ZONE_META, Zone } from "@/components/ZoneSelector";
import { SeatMap, type Seat, type Zones } from "@/components/SeatMap";
import { ReservationCart } from "@/components/ReservationCart";
import { LiveStatus } from "@/components/LiveStatus";
import type { LiveEvent } from "@/lib/api";

const EASE = [0.22, 1, 0.36, 1] as const;

const MOCK_ZONES: Zones = { VIP: 12, Or: 67, Standard: 213, Populaire: 584 };
const MAX_SEATS = 8;

export default function ReservePage({ params }: { params: { id: string } }) {
  const meta = findMatch(params.id);
  const matchUuid = meta?.uuid ?? params.id;

  const [zones, setZones] = useState<Zones | null>(null);
  const [zoneFilter, setZoneFilter] = useState<Zone | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [session, setSession] = useState<string | null>(null);
  const [liveUpdates, setLiveUpdates] = useState<Record<string, LiveEvent["status"]>>({});

  useEffect(() => { setSession(getSessionId()); }, []);

  useEffect(() => {
    let cancelled = false;
    api.matchAvailability(matchUuid)
      .then((r) => { if (!cancelled) setZones(r.zones); })
      .catch(() => { if (!cancelled) setZones(MOCK_ZONES); });
    return () => { cancelled = true; };
  }, [matchUuid]);

  useEffect(() => { setSelectedSeats([]); }, [zones]);

  const handleSeatStatus = useCallback((seatId: string, status: LiveEvent["status"]) => {
    setLiveUpdates((prev) => ({ ...prev, [seatId]: status }));
    if (status !== "free") {
      setSelectedSeats((prev) => prev.filter((s) => s.id !== seatId));
    }
  }, []);

  const handleToggleSeat = (seat: Seat) => {
    const isSelected = selectedSeats.some((s) => s.id === seat.id);
    if (isSelected) {
      setSelectedSeats(selectedSeats.filter((s) => s.id !== seat.id));
    } else {
      if (selectedSeats.length >= MAX_SEATS) {
        alert(`Vous ne pouvez pas réserver plus de ${MAX_SEATS} places.`);
        return;
      }
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const removeSeat = (seatId: string) => setSelectedSeats((prev) => prev.filter((s) => s.id !== seatId));

  const totalPrice = useMemo(
    () => selectedSeats.reduce((total, seat) => total + ZONE_META[seat.zone].price, 0),
    [selectedSeats]
  );

  return (
    <div className="relative flex flex-col h-[calc(100dvh-4rem)] text-slate-200 selection:bg-cyan-400/30 overflow-hidden" style={{ background: "#04070d" }}>

      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #050912 0%, #08111f 40%, #0a1628 70%, #050a14 100%)" }} />

        <motion.div className="absolute -top-12 h-[135%] w-[460px]"
          style={{ left: "calc(12.5% - 230px)", background: "linear-gradient(180deg, rgba(125,211,252,0.22) 0%, rgba(34,211,238,0.07) 38%, transparent 72%)", clipPath: "polygon(50% 0, 100% 100%, 0 100%)", filter: "blur(28px)", mixBlendMode: "screen", transformOrigin: "50% 0%" }}
          animate={{ rotate: [-12, -9, -15, -11, -13, -12] }} transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute -top-12 h-[135%] w-[460px]"
          style={{ left: "calc(37.5% - 230px)", background: "linear-gradient(180deg, rgba(196,181,253,0.22) 0%, rgba(167,139,250,0.07) 40%, transparent 75%)", clipPath: "polygon(50% 0, 100% 100%, 0 100%)", filter: "blur(30px)", mixBlendMode: "screen", transformOrigin: "50% 0%" }}
          animate={{ rotate: [4, 7, 2, 5, 3, 4] }} transition={{ duration: 12.6, repeat: Infinity, ease: "easeInOut", delay: 2.1 }} />
        <motion.div className="absolute -top-12 h-[135%] w-[460px]"
          style={{ left: "calc(62.5% - 230px)", background: "linear-gradient(180deg, rgba(186,230,253,0.24) 0%, rgba(103,232,249,0.08) 42%, transparent 78%)", clipPath: "polygon(50% 0, 100% 100%, 0 100%)", filter: "blur(32px)", mixBlendMode: "screen", transformOrigin: "50% 0%" }}
          animate={{ rotate: [-4, -2, -7, -3, -5, -4] }} transition={{ duration: 11.7, repeat: Infinity, ease: "easeInOut", delay: 0.6 }} />
        <motion.div className="absolute -top-12 h-[135%] w-[460px]"
          style={{ left: "calc(87.5% - 230px)", background: "linear-gradient(180deg, rgba(253,224,71,0.20) 0%, rgba(251,191,36,0.07) 38%, transparent 72%)", clipPath: "polygon(50% 0, 100% 100%, 0 100%)", filter: "blur(28px)", mixBlendMode: "screen", transformOrigin: "50% 0%" }}
          animate={{ rotate: [12, 15, 9, 13, 11, 12] }} transition={{ duration: 10.4, repeat: Infinity, ease: "easeInOut", delay: 1.3 }} />

        <svg className="absolute inset-0 h-full w-full opacity-[0.18]" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="ringFade" cx="50%" cy="55%" r="60%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
              <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g fill="none" stroke="url(#ringFade)" strokeWidth="1">
            <ellipse cx="50%" cy="55%" rx="22%" ry="14%" />
            <ellipse cx="50%" cy="55%" rx="32%" ry="20%" />
            <ellipse cx="50%" cy="55%" rx="44%" ry="28%" />
            <ellipse cx="50%" cy="55%" rx="58%" ry="36%" />
            <ellipse cx="50%" cy="55%" rx="74%" ry="46%" />
          </g>
        </svg>

        <motion.div className="absolute -bottom-60 -left-40 h-[700px] w-[700px] rounded-full"
          style={{ background: "radial-gradient(circle, #0891b2 0%, transparent 60%)", mixBlendMode: "screen", filter: "blur(80px)", opacity: 0.55 }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.6, 0.45] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute -bottom-60 -right-40 h-[650px] w-[650px] rounded-full"
          style={{ background: "radial-gradient(circle, #b45309 0%, transparent 60%)", mixBlendMode: "screen", filter: "blur(90px)", opacity: 0.4 }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.45, 0.3] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }} />

        <div className="absolute inset-0 opacity-[0.22]" style={{ backgroundImage: "radial-gradient(circle at center, rgba(186,230,253,0.85) 1px, transparent 1.5px)", backgroundSize: "28px 28px", maskImage: "radial-gradient(ellipse 45% 65% at 50% 55%, black 40%, transparent 100%)" }} />
        <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E\")" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(2,6,12,0.7) 100%)" }} />
      </div>

      <div className="relative flex-1 min-h-0">
        <div className="absolute top-6 left-6 z-20 pointer-events-auto">
          <Link href={`/matches/${params.id}`} className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-navy-900/50 px-3 py-1.5 text-sm text-white/70 backdrop-blur-md transition-colors hover:border-cyan-400/40 hover:text-cyan-300">
            <ArrowLeft size={14} />Retour au match
          </Link>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="text-center pt-4">
            <p className="font-mono text-sm uppercase tracking-[0.3em] text-white/40 flex items-center justify-center gap-2">
              {meta ? <><Flag code={meta.home} size={22} /> vs <Flag code={meta.away} size={22} /></> : params.id}
            </p>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-gold-300 tracking-tight mt-2 leading-[1.05]">
              Sélection de places
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <p className="text-white/40 flex items-center gap-1.5 text-base">
                <MapPin size={16} className="text-cyan-400" />
                {meta ? meta.stadium : "Stade Olympique"} · Plan Interactif
              </p>
              <LiveStatus matchId={matchUuid} onSeatStatus={handleSeatStatus} />
            </div>
          </motion.div>
        </div>

        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
          <ZoneSelector selected={zoneFilter} onChange={setZoneFilter} />
        </div>

        <div className="absolute top-14 right-4 z-30 w-80">
          <ReservationCart
            selected={selectedSeats}
            onRemove={removeSeat}
            totalPrice={totalPrice}
            session={session}
            max={MAX_SEATS}
          />
        </div>

        {zones && (
          <SeatMap
            zones={zones}
            selectedSeats={selectedSeats}
            onToggleSeat={handleToggleSeat}
            zoneFilter={zoneFilter}
            liveUpdates={liveUpdates}
          />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .clip-half-right { clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%); }
        .clip-half-left { clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%); }
      ` }} />
    </div>
  );
}
