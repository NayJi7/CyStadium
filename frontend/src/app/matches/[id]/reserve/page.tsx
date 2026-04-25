"use client";

import Link from "next/link";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { ArrowLeft, Check, Radio, ShoppingCart, Ticket, Trash2, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { api, openLiveSocket } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import { Flag } from "@/components/Flag";
import { findMatch } from "@/lib/matches";

const EASE = [0.22, 1, 0.36, 1] as const;

type Zones = Record<string, number>;

const ZONE_ORDER = ["VIP", "Or", "Standard", "Populaire"] as const;
type Zone = (typeof ZONE_ORDER)[number];

const ZONE_PRICE: Record<Zone, number> = {
  VIP: 480, Or: 220, Standard: 95, Populaire: 45,
};

const ZONE_CAPACITY: Record<Zone, number> = {
  VIP: 30, Or: 150, Standard: 400, Populaire: 800,
};

const MOCK_ZONES: Zones = {
  VIP: 12, Or: 67, Standard: 213, Populaire: 584,
};

const ZONES = {
  Populaire: { id: 'populaire', name: 'Populaire', price: 45, color: 'bg-emerald-400', seatBg: 'bg-emerald-400', seatBorder: 'border-emerald-600', shadow: 'shadow-emerald-400/50' },
  Standard: { id: 'standard', name: 'Standard', price: 95, color: 'bg-blue-400', seatBg: 'bg-blue-400', seatBorder: 'border-blue-600', shadow: 'shadow-blue-400/50' },
  Or: { id: 'or', name: 'Or', price: 220, color: 'bg-gold-400', seatBg: 'bg-gold-400', seatBorder: 'border-gold-600', shadow: 'shadow-gold-400/50' },
  VIP: { id: 'vip', name: 'VIP', price: 480, color: 'bg-fuchsia-500', seatBg: 'bg-fuchsia-500', seatBorder: 'border-fuchsia-700', shadow: 'shadow-fuchsia-500/50' },
};

const MAX_SEATS = 8;
const TOTAL_CAPACITY = Object.values(ZONE_CAPACITY).reduce((a, b) => a + b, 0);

// --- GÉNÉRATION DU STADE (positions relatives au centre 0,0) ---
function generateStadiumData(availableCounts: Zones) {
  const seats: any[] = [];
  let seatIdCounter = 1;
  let remainingSeats = TOTAL_CAPACITY;
  const availableToPlace = { ...availableCounts };
  let r = 0;

  while (remainingSeats > 0) {
    const rx = 280 + (r * 24);
    const ry = 190 + (r * 24);
    const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    let numSeats = Math.floor(perimeter / 18);
    if (remainingSeats < numSeats) numSeats = remainingSeats;

    for (let s = 0; s < numSeats; s++) {
      const angle = (s / numSeats) * Math.PI * 2;
      const x = rx * Math.cos(angle);
      const y = ry * Math.sin(angle);

      let normAngle = angle;
      if (normAngle < 0) normAngle += Math.PI * 2;

      let sectionName = 'Est';
      if (normAngle > Math.PI / 4 && normAngle <= 3 * Math.PI / 4) sectionName = 'Sud';
      else if (normAngle > 3 * Math.PI / 4 && normAngle <= 5 * Math.PI / 4) sectionName = 'Ouest';
      else if (normAngle > 5 * Math.PI / 4 && normAngle <= 7 * Math.PI / 4) sectionName = 'Nord';

      const isCurve = sectionName === 'Est' || sectionName === 'Ouest';
      const isCentral = (normAngle > Math.PI / 2 - 0.4 && normAngle < Math.PI / 2 + 0.4) ||
        (normAngle > 3 * Math.PI / 2 - 0.4 && normAngle < 3 * Math.PI / 2 + 0.4);

      let zone: Zone = 'Standard';
      if (isCurve) {
        zone = r >= 3 ? 'Populaire' : 'Standard';
      } else if (isCentral) {
        if (r < 2) zone = 'VIP';
        else if (r < 4) zone = 'Or';
        else zone = 'Standard';
      } else {
        if (r < 3) zone = 'Or';
        else zone = 'Standard';
      }

      const rotation = (angle + Math.PI / 2) * (180 / Math.PI);

      let isAvailable = false;
      if (availableToPlace[zone] && availableToPlace[zone] > 0) {
        if (Math.random() < 0.6) {
          isAvailable = true;
          availableToPlace[zone]--;
        }
      }

      seats.push({
        id: `S${seatIdCounter++}`, section: sectionName, row: r + 1, num: s + 1,
        x, y, rotation, zone, status: isAvailable ? 'available' : 'occupied',
      });
    }

    remainingSeats -= numSeats;
    r++;
  }

  const maxRx = 280 + ((r - 1) * 24);
  const maxRy = 190 + ((r - 1) * 24);
  return { seats, maxRx, maxRy };
}

export default function ReservePage({ params }: { params: { id: string } }) {
  const meta = findMatch(params.id);
  const matchUuid = meta?.uuid ?? params.id;

  const [zones, setZones] = useState<Zones | null>(null);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<Zone | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [session, setSession] = useState<string | null>(null);

  const [stadiumData, setStadiumData] = useState<{ seats: any[]; maxRx: number; maxRy: number }>({ seats: [], maxRx: 0, maxRy: 0 });
  const [selectedSeats, setSelectedSeats] = useState<any[]>([]);
  const [hoveredSeat, setHoveredSeat] = useState<any | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => { setSession(getSessionId()); }, []);

  useEffect(() => {
    let ok = false;
    api.matchAvailability(matchUuid).then((r) => {
      if (ok) return;
      setZones(r.zones);
    }).catch(() => {
      if (ok) return;
      setZones(MOCK_ZONES);
    });
    return () => { ok = true; };
  }, [matchUuid]);

  useEffect(() => {
    let sock: WebSocket | null = null;
    try { sock = openLiveSocket(matchUuid, () => setLiveCount((n) => n + 1)); } catch {}
    return () => sock?.close();
  }, [matchUuid]);

  useEffect(() => {
    if (zones) {
      setStadiumData(generateStadiumData(zones));
      setSelectedSeats([]);
    }
  }, [zones]);

  // Auto-scale stadium to fit container
  useEffect(() => {
    if (!containerRef.current || stadiumData.maxRx === 0) return;
    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;
      const availableWidth = container.clientWidth - 60;
      const availableHeight = container.clientHeight - 60;
      const intrinsicWidth = (stadiumData.maxRx + 50) * 2;
      const intrinsicHeight = (stadiumData.maxRy + 50) * 2;
      setScale(Math.min(availableWidth / intrinsicWidth, availableHeight / intrinsicHeight, 1));
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    updateScale();
    return () => observer.disconnect();
  }, [stadiumData]);

  const handleSeatClick = (seat: any) => {
    if (seat.status === 'occupied') return;
    const isSelected = selectedSeats.some(s => s.id === seat.id);
    if (isSelected) {
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      if (selectedSeats.length >= MAX_SEATS) {
        alert(`Vous ne pouvez pas réserver plus de ${MAX_SEATS} places.`);
        return;
      }
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const removeSeat = (seatId: string) => {
    setSelectedSeats(selectedSeats.filter(s => s.id !== seatId));
  };

  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((total, seat) => total + ZONES[seat.zone as keyof typeof ZONES].price, 0);
  }, [selectedSeats]);

  return (
    <div className="relative flex flex-col h-[calc(100dvh-4rem)] text-slate-200 selection:bg-cyan-400/30 overflow-hidden" style={{ background: '#04070d' }}>

      {/* ── Stadium architectural background ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Deep base — atmospheric night */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #050912 0%, #08111f 40%, #0a1628 70%, #050a14 100%)' }} />

        {/* Floodlight cone — 1/8 (cyan) */}
        <motion.div
          className="absolute -top-12 h-[135%] w-[460px]"
          style={{
            left: 'calc(12.5% - 230px)',
            background: 'linear-gradient(180deg, rgba(125,211,252,0.22) 0%, rgba(34,211,238,0.07) 38%, transparent 72%)',
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            filter: 'blur(28px)',
            mixBlendMode: 'screen',
            transformOrigin: '50% 0%',
          }}
          animate={{ rotate: [-12, -9, -15, -11, -13, -12] }}
          transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Floodlight cone — 3/8 (violet) */}
        <motion.div
          className="absolute -top-12 h-[135%] w-[460px]"
          style={{
            left: 'calc(37.5% - 230px)',
            background: 'linear-gradient(180deg, rgba(196,181,253,0.22) 0%, rgba(167,139,250,0.07) 40%, transparent 75%)',
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            filter: 'blur(30px)',
            mixBlendMode: 'screen',
            transformOrigin: '50% 0%',
          }}
          animate={{ rotate: [4, 7, 2, 5, 3, 4] }}
          transition={{ duration: 12.6, repeat: Infinity, ease: "easeInOut", delay: 2.1 }}
        />
        {/* Floodlight cone — 5/8 (sky) */}
        <motion.div
          className="absolute -top-12 h-[135%] w-[460px]"
          style={{
            left: 'calc(62.5% - 230px)',
            background: 'linear-gradient(180deg, rgba(186,230,253,0.24) 0%, rgba(103,232,249,0.08) 42%, transparent 78%)',
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            filter: 'blur(32px)',
            mixBlendMode: 'screen',
            transformOrigin: '50% 0%',
          }}
          animate={{ rotate: [-4, -2, -7, -3, -5, -4] }}
          transition={{ duration: 11.7, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />
        {/* Floodlight cone — 7/8 (gold) */}
        <motion.div
          className="absolute -top-12 h-[135%] w-[460px]"
          style={{
            left: 'calc(87.5% - 230px)',
            background: 'linear-gradient(180deg, rgba(253,224,71,0.20) 0%, rgba(251,191,36,0.07) 38%, transparent 72%)',
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            filter: 'blur(28px)',
            mixBlendMode: 'screen',
            transformOrigin: '50% 0%',
          }}
          animate={{ rotate: [12, 15, 9, 13, 11, 12] }}
          transition={{ duration: 10.4, repeat: Infinity, ease: "easeInOut", delay: 1.3 }}
        />

        {/* Concentric stadium rings — echo arena geometry */}
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

        {/* Animated cyan corner glow — subtle motion */}
        <motion.div
          className="absolute -bottom-60 -left-40 h-[700px] w-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, #0891b2 0%, transparent 60%)', mixBlendMode: 'screen', filter: 'blur(80px)', opacity: 0.55 }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.6, 0.45] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-60 -right-40 h-[650px] w-[650px] rounded-full"
          style={{ background: 'radial-gradient(circle, #b45309 0%, transparent 60%)', mixBlendMode: 'screen', filter: 'blur(90px)', opacity: 0.4 }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.45, 0.3] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        {/* Hexagonal/dotted texture — crowd suggestion */}
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: 'radial-gradient(circle at center, rgba(186,230,253,0.85) 1px, transparent 1.5px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 45% 65% at 50% 55%, black 40%, transparent 100%)',
          }}
        />

        {/* Grain — adds film texture */}
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E\")",
          }}
        />

        {/* Edge vignette */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(2,6,12,0.7) 100%)' }} />
      </div>

      {/* ─── Stadium area ─── */}
      <div className="relative flex-1 min-h-0">
        {/* Match info — top left, well-spaced */}
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
                {meta ? meta.stadium : 'Stade Olympique'} · Plan Interactif
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">
                <Radio size={12} className="animate-pulse" aria-hidden />Live · {liveCount}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Zone filters — vertically centered left */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 pointer-events-auto">
          {Object.values(ZONES).map(zone => (
            <button
              key={zone.id}
              className={`flex items-center gap-3 text-base px-4 py-2 rounded-lg cursor-pointer transition-all text-left ${selectedZoneFilter === zone.name ? 'ring-2 ring-white/50 bg-white/10 backdrop-blur-sm' : 'bg-white/[0.04] backdrop-blur-sm hover:bg-white/10'}`}
              onClick={() => setSelectedZoneFilter(selectedZoneFilter === zone.name ? null : zone.name as Zone)}
            >
              <div className={`w-4 h-5 rounded-t-[5px] rounded-b-[2px] border-t-[3px] border-x border-b ${zone.seatBg} ${zone.seatBorder}`} />
              <span className="text-gray-200 font-medium">{zone.name} <span className="text-gray-500">({zone.price}€)</span></span>
            </button>
          ))}
        </div>

        {/* Floating cart — top right overlay */}
        <div className="absolute top-14 right-4 z-30 w-80">
          {selectedSeats.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 px-5 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/[0.06] text-white/25 text-center">
              <Ticket size={24} className="opacity-50 text-cyan-400" />
              <span className="text-base">Cliquez sur les sièges</span>
              <span className="text-xs text-white/20">Max {MAX_SEATS} places</span>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/[0.08] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="flex items-center gap-2.5">
                  <ShoppingCart size={20} className="text-cyan-400" />
                  <span className="text-base font-semibold text-white/80">{selectedSeats.length}/{MAX_SEATS}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/40 uppercase tracking-wider">Total</div>
                  <div className="text-2xl font-black text-white leading-tight">{totalPrice}€</div>
                </div>
              </div>
              <div className="flex flex-col gap-2 px-4 pb-2">
                {selectedSeats.map(seat => {
                  const zone = ZONES[seat.zone as keyof typeof ZONES];
                  if (!zone) return null;
                  return (
                    <div key={seat.id} className="flex items-center gap-3 bg-white/5 border border-white/[0.08] rounded-lg px-4 py-2.5 text-base whitespace-nowrap hover:border-white/20 transition-colors group">
                      <div className={`w-2 h-5 rounded-full ${zone.color} flex-shrink-0`} />
                      <span className="text-gray-200 flex-1">{seat.section} · R{seat.row} P{seat.num}</span>
                      <span className="text-white/60 font-medium">{zone.price}€</span>
                      <button onClick={() => removeSeat(seat.id)} className="text-white/30 hover:text-red-400 transition-colors ml-1">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 pb-4 pt-2">
                <Button className="w-full" size="sm" disabled={selectedSeats.length === 0 || !session} title={!session ? 'Connexion requise' : undefined}>
                  <Check size={15} aria-hidden /> Confirmer ({totalPrice}€)
                </Button>
                {!session && (
                  <p className="text-center text-xs text-white/30 mt-1.5"><Link href="/login" className="text-cyan-300 hover:underline">Se connecter</Link> pour finaliser</p>
                )}
              </div>
            </div>
          )}
        </div>

      <div ref={containerRef} className="relative z-0 w-full h-full min-h-0 overflow-hidden flex items-center justify-center">
        <div
          className="relative flex-shrink-0 origin-center transition-transform duration-300 ease-out"
          style={{
            width: `${(stadiumData.maxRx + 50) * 2}px`,
            height: `${(stadiumData.maxRy + 50) * 2}px`,
            transform: `scale(${scale})`,
          }}
        >
          {/* Cardinal labels — positioned dynamically outside rings */}
          <div className="absolute text-white/[0.08] font-black tracking-[1em] pl-[1em] text-6xl uppercase pointer-events-none select-none transition-all duration-300"
            style={{ top: `calc(50% - ${stadiumData.maxRy + 40}px)`, left: '50%', transform: 'translate(-50%, -50%)' }}>Nord</div>
          <div className="absolute text-white/[0.08] font-black tracking-[1em] pl-[1em] text-6xl uppercase pointer-events-none select-none transition-all duration-300"
            style={{ top: `calc(50% + ${stadiumData.maxRy + 40}px)`, left: '50%', transform: 'translate(-50%, -50%)' }}>Sud</div>
          <div className="absolute text-white/[0.08] font-black tracking-[1em] pl-[1em] text-6xl uppercase pointer-events-none select-none transition-all duration-300"
            style={{ top: '50%', left: `calc(50% - ${stadiumData.maxRx + 40}px)`, transform: 'translate(-50%, -50%) rotate(-90deg)' }}>Ouest</div>
          <div className="absolute text-white/[0.08] font-black tracking-[1em] pl-[1em] text-6xl uppercase pointer-events-none select-none transition-all duration-300"
            style={{ top: '50%', left: `calc(50% + ${stadiumData.maxRx + 40}px)`, transform: 'translate(-50%, -50%) rotate(90deg)' }}>Est</div>

          {/* Pitch */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[220px] bg-[#1a532d] border-[3px] border-white/90 flex items-center justify-center z-0 shadow-[0_0_80px_rgba(22,163,74,0.3)]">
            <div className="absolute inset-0 flex flex-col opacity-20 pointer-events-none">
              {[...Array(11)].map((_, i) => (
                <div key={i} className={`flex-1 w-full ${i % 2 === 0 ? 'bg-white' : 'bg-transparent'}`} />
              ))}
            </div>
            <div className="absolute h-full w-[2px] bg-white/70 left-1/2 -translate-x-1/2 shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
            <div className="absolute w-[60px] h-[60px] border-[2px] border-white/70 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
            <div className="absolute w-[4px] h-[4px] bg-white/90 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
            {/* Left goal */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[54px] h-[100px] border-[2px] border-white/70 border-l-0 flex items-center shadow-[0_0_4px_rgba(255,255,255,0.5)]">
              <div className="w-[18px] h-[46px] border-[2px] border-white/70 border-l-0 absolute left-0" />
              <div className="w-[3px] h-[3px] bg-white/90 rounded-full absolute right-[10px]" />
              <div className="w-[30px] h-[40px] border-[2px] border-white/70 rounded-full absolute -right-[15px] clip-half-right opacity-60" />
            </div>
            {/* Right goal */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[54px] h-[100px] border-[2px] border-white/70 border-r-0 flex items-center justify-end shadow-[0_0_4px_rgba(255,255,255,0.5)]">
              <div className="w-[18px] h-[46px] border-[2px] border-white/70 border-r-0 absolute right-0" />
              <div className="w-[3px] h-[3px] bg-white/90 rounded-full absolute left-[10px]" />
              <div className="w-[30px] h-[40px] border-[2px] border-white/70 rounded-full absolute -left-[15px] clip-half-left opacity-60" />
            </div>
          </div>

          {/* SEATS */}
          {stadiumData.seats.map(seat => {
            const isSelected = selectedSeats.some(s => s.id === seat.id);
            const isOccupied = seat.status === 'occupied';
            const zoneInfo = ZONES[seat.zone as keyof typeof ZONES];
            if (!zoneInfo) return null;
            const isFilteredOut = selectedZoneFilter && seat.zone !== selectedZoneFilter;

            return (
              <div
                key={seat.id}
                className={`absolute transition-all duration-200 flex items-end justify-center pb-[2px]
                  w-[14px] h-[16px] rounded-t-[4px] rounded-b-[2px] border-t-[4px] border-x-[1px] border-b-[1px]
                  ${isOccupied ? 'bg-gray-800 border-gray-700 cursor-not-allowed opacity-30' : 'cursor-pointer'}
                  ${isFilteredOut && !isSelected ? `${zoneInfo.seatBg} ${zoneInfo.seatBorder} opacity-20 pointer-events-none scale-90 grayscale` : ''}
                  ${!isOccupied && !isSelected && !isFilteredOut ? `${zoneInfo.seatBg} ${zoneInfo.seatBorder} opacity-90 hover:opacity-100 hover:scale-[2] hover:z-30` : ''}
                  ${isSelected ? `${zoneInfo.seatBg} border-white ring-2 ring-white scale-[2] z-30 ${zoneInfo.shadow}` : ''}
                `}
                style={{
                  left: `calc(50% + ${seat.x}px)`,
                  top: `calc(50% + ${seat.y}px)`,
                  transform: `translate(-50%, -50%) rotate(${seat.rotation}deg)`,
                  boxShadow: isOccupied || isFilteredOut ? 'none' : 'inset 0 -2px 4px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)',
                }}
                onMouseEnter={() => !isOccupied && !isFilteredOut && setHoveredSeat(seat)}
                onMouseLeave={() => setHoveredSeat(null)}
                onClick={() => !isFilteredOut && handleSeatClick(seat)}
              >
                {!isOccupied && <div className="w-[10px] h-[8px] bg-black/15 rounded-sm" />}
              </div>
            );
          })}

          {/* TOOLTIP */}
          {hoveredSeat && (() => {
            const zi = ZONES[hoveredSeat.zone as keyof typeof ZONES];
            if (!zi) return null;
            return (
              <div
                className="absolute z-50 pointer-events-none"
                style={{
                  left: `calc(50% + ${hoveredSeat.x}px)`,
                  top: `calc(50% + ${hoveredSeat.y}px)`,
                  transform: hoveredSeat.x > 0
                    ? 'translate(6px, calc(-100% - 6px))'
                    : 'translate(calc(-100% - 6px), calc(-100% - 6px))',
                }}
              >
                <div className="bg-gray-900/95 backdrop-blur-sm text-white px-5 py-3.5 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-gray-700/50 flex flex-col items-center min-w-[150px]">
                  <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1.5">Tribune {hoveredSeat.section}</div>
                  <div className="text-base font-medium mb-2.5 whitespace-nowrap">Rang {hoveredSeat.row} · Place {hoveredSeat.num}</div>
                  <div className={`text-sm px-2.5 py-1 rounded-sm font-bold ${zi.color} text-white`}>{zi.name} — {zi.price}€</div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
        .clip-half-right { clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%); }
        .clip-half-left { clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%); }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
      ` }} />
    </div>
  );
}