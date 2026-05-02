"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ZONE_META, Zone } from "./ZoneSelector";
import type { SeatInfo } from "@/lib/api";

export type SeatStatus = "available" | "occupied";

export type Seat = {
  id: string;
  section: string;
  row: number;
  num: number;
  x: number;
  y: number;
  rotation: number;
  zone: Zone;
  status: SeatStatus;
};

export type Zones = Record<string, number>;

const DEFAULT_TOTAL_CAPACITY = 1380;

function generateStadiumData(zones: Zones) {
  const BASE_RX = 260;
  const BASE_RY = 170;
  const RING_GAP = 22;
  const SEAT_SPACING = 15;
  const MAX_RINGS = 12;

  function getZone(ringIdx: number, normAngle: number): Zone {
    const isCurve = normAngle <= Math.PI / 4 || normAngle > 7 * Math.PI / 4 ||
                    (normAngle > 3 * Math.PI / 4 && normAngle <= 5 * Math.PI / 4);
    const isCentral =
      (normAngle > Math.PI / 2 - 0.4 && normAngle < Math.PI / 2 + 0.4) ||
      (normAngle > 3 * Math.PI / 2 - 0.4 && normAngle < 3 * Math.PI / 2 + 0.4);

    if (isCurve) {
      return ringIdx >= 4 ? "Populaire" : "Standard";
    } else if (isCentral) {
      if (ringIdx < 2) return "VIP";
      if (ringIdx < 3) return "Or";
      if (ringIdx < 5) return "Standard";
      return "Populaire";
    } else {
      return ringIdx < 2 ? "Or" : ringIdx < 4 ? "Standard" : "Populaire";
    }
  }

  function buildArcTable(rx: number, ry: number, steps: number): number[] {
    const table: number[] = [0];
    let total = 0;
    for (let i = 1; i <= steps; i++) {
      const a0 = ((i - 1) / steps) * Math.PI * 2;
      const a1 = (i / steps) * Math.PI * 2;
      const dx = rx * (Math.cos(a1) - Math.cos(a0));
      const dy = ry * (Math.sin(a1) - Math.sin(a0));
      total += Math.sqrt(dx * dx + dy * dy);
      table.push(total);
    }
    return table;
  }

  function angleAtArc(arcTable: number[], targetArc: number, steps: number): number {
    const total = arcTable[steps];
    const t = ((targetArc % total) + total) % total;
    let lo = 0, hi = steps;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arcTable[mid] < t) lo = mid + 1; else hi = mid;
    }
    if (lo === 0) return 0;
    const prev = arcTable[lo - 1];
    const curr = arcTable[lo];
    const frac = (t - prev) / (curr - prev);
    return ((lo - 1 + frac) / steps) * Math.PI * 2;
  }

  // 1. Generate a generous template oval
  let seatIdCounter = 1;
  const template: { id: string; section: string; row: number; num: number; x: number; y: number; rotation: number; zone: Zone }[] = [];

  for (let r = 0; r < MAX_RINGS; r++) {
    const rx = BASE_RX + r * RING_GAP;
    const ry = BASE_RY + r * RING_GAP;
    const steps = 500;
    const arcTable = buildArcTable(rx, ry, steps);
    const totalLen = arcTable[steps];
    const numSeats = Math.round(totalLen / SEAT_SPACING);

    for (let s = 0; s < numSeats; s++) {
      const arcPos = (s / numSeats) * totalLen;
      const angle = angleAtArc(arcTable, arcPos, steps);
      const x = rx * Math.cos(angle);
      const y = ry * Math.sin(angle);

      let normAngle = angle;
      if (normAngle < 0) normAngle += Math.PI * 2;

      let sectionName = "Est";
      if (normAngle > Math.PI / 4 && normAngle <= (3 * Math.PI) / 4) sectionName = "Sud";
      else if (normAngle > (3 * Math.PI) / 4 && normAngle <= (5 * Math.PI) / 4) sectionName = "Ouest";
      else if (normAngle > (5 * Math.PI) / 4 && normAngle <= (7 * Math.PI) / 4) sectionName = "Nord";

      const zone = getZone(r, normAngle);
      const rotation = (angle + Math.PI / 2) * (180 / Math.PI);

      template.push({
        id: `S${seatIdCounter++}`,
        section: sectionName,
        row: r + 1,
        num: s + 1,
        x,
        y,
        rotation,
        zone,
      });
    }
  }

  // 2. Group template positions by zone, sorted inner (low row) first
  const byZone: Record<string, typeof template> = {};
  for (const pos of template) {
    if (!byZone[pos.zone]) byZone[pos.zone] = [];
    byZone[pos.zone].push(pos);
  }
  for (const z of Object.keys(byZone)) {
    byZone[z].sort((a, b) => a.row - b.row || a.num - b.num);
  }

  // 3. Keep exactly as many positions as we have seats per zone (inner rings first)
  //    For the last (partial) ring, distribute seats evenly around the oval
  const seats: Seat[] = [];
  let maxRx = 0;
  let maxRy = 0;
  const zoneCounts: Record<string, number> = { VIP: 0, Or: 0, Standard: 0, Populaire: 0 };
  for (const [z, count] of Object.entries(zones)) {
    zoneCounts[z] = count;
  }

  for (const [z, positions] of Object.entries(byZone)) {
    const keep = zoneCounts[z] ?? positions.length;
    if (keep >= positions.length) {
      // Take all
      for (const p of positions) {
        const rx = Math.abs(p.x);
        const ry = Math.abs(p.y);
        if (rx > maxRx) maxRx = rx;
        if (ry > maxRy) maxRy = ry;
        seats.push({ ...p, status: "available" as const });
      }
      continue;
    }

    // Group by ring (row) to find complete vs partial rings
    const byRow: Record<number, typeof positions> = {};
    for (const p of positions) {
      if (!byRow[p.row]) byRow[p.row] = [];
      byRow[p.row].push(p);
    }
    const rows = Object.keys(byRow).map(Number).sort((a, b) => a - b);

    let remaining = keep;
    for (let ri = 0; ri < rows.length; ri++) {
      const rowPositions = byRow[rows[ri]];
      if (remaining >= rowPositions.length) {
        // Full ring — take all
        for (const p of rowPositions) {
          const rx = Math.abs(p.x);
          const ry = Math.abs(p.y);
          if (rx > maxRx) maxRx = rx;
          if (ry > maxRy) maxRy = ry;
          seats.push({ ...p, status: "available" as const });
        }
        remaining -= rowPositions.length;
      } else if (remaining > 0) {
        // Partial ring — distribute evenly around the oval
        for (let i = 0; i < remaining; i++) {
          // Pick evenly: stride = rowPositions.length / remaining
          const idx = Math.floor(i * rowPositions.length / remaining);
          const p = rowPositions[idx];
          const rx = Math.abs(p.x);
          const ry = Math.abs(p.y);
          if (rx > maxRx) maxRx = rx;
          if (ry > maxRy) maxRy = ry;
          seats.push({ ...p, status: "available" as const });
        }
        remaining = 0;
      }
    }
  }

  return { seats, maxRx, maxRy };
}

/**
 * Map real API seat data into the internal Seat format.
 * Distribue les sièges API dans les positions générées par zone (index-based),
 * car la DB ne stocke pas les coordonnées x/y/rotation du plan interactif.
 */
function mapApiSeats(
  apiSeats: SeatInfo[],
  fallbackData: { seats: Seat[]; maxRx: number; maxRy: number }
): { seats: Seat[]; maxRx: number; maxRy: number } {
  // Grouper les sièges API par zone, triés par label pour un mapping déterministe
  const apiByZone = new Map<string, SeatInfo[]>();
  for (const s of apiSeats) {
    const z = s.zone;
    if (!apiByZone.has(z)) apiByZone.set(z, []);
    apiByZone.get(z)!.push(s);
  }
  for (const [, seats] of apiByZone) {
    seats.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
  }

  // Grouper les positions générées par zone
  const layoutByZone = new Map<string, Seat[]>();
  for (const s of fallbackData.seats) {
    if (!layoutByZone.has(s.zone)) layoutByZone.set(s.zone, []);
    layoutByZone.get(s.zone)!.push(s);
  }

  const mapped: Seat[] = [];

  // Assigner chaque siège API à la position générée de même index dans sa zone
  for (const [zone, zoneApiSeats] of apiByZone) {
    const layoutSeats = layoutByZone.get(zone as Zone) ?? [];
    zoneApiSeats.forEach((apiSeat, idx) => {
      const layoutSeat = layoutSeats[idx];
      if (!layoutSeat) return;
      mapped.push({
        id: apiSeat.seat_id,
        section: layoutSeat.section,
        row: layoutSeat.row,
        num: layoutSeat.num,
        x: layoutSeat.x,
        y: layoutSeat.y,
        rotation: layoutSeat.rotation,
        zone: zone as Zone,
        status: apiSeat.status === "free" ? "available" : "occupied",
      });
    });
  }

  return { seats: mapped, maxRx: fallbackData.maxRx, maxRy: fallbackData.maxRy };
}

type Props = {
  zones: Zones;
  seats?: SeatInfo[] | null;
  selectedSeats: Seat[];
  onToggleSeat: (seat: Seat) => void;
  zoneFilter: Zone | null;
  liveUpdates?: Record<string, "free" | "reserved" | "confirmed" | "locked">;
};

export function SeatMap({ zones, seats: apiSeats, selectedSeats, onToggleSeat, zoneFilter, liveUpdates }: Props) {
  const [fallbackData, setFallbackData] = useState<{ seats: Seat[]; maxRx: number; maxRy: number }>({ seats: [], maxRx: 0, maxRy: 0 });
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setFallbackData(generateStadiumData(zones));
  }, [zones]); // eslint-disable-line react-hooks/exhaustive-deps

  const stadiumData = useMemo(() => {
    if (apiSeats && apiSeats.length > 0) {
      return mapApiSeats(apiSeats, fallbackData);
    }
    return fallbackData;
  }, [apiSeats, fallbackData]);

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

  const seats = useMemo(() => {
    if (!liveUpdates) return stadiumData.seats;
    return stadiumData.seats.map((s) => {
      const upd = liveUpdates[s.id];
      if (!upd) return s;
      return { ...s, status: upd === "free" ? "available" : (upd as Seat["status"]) } as Seat;
    });
  }, [stadiumData.seats, liveUpdates]);

  return (
    <div ref={containerRef} className="relative z-0 w-full h-full min-h-0 overflow-hidden flex items-center justify-center">
      <div
        className="relative flex-shrink-0 origin-center transition-transform duration-300 ease-out"
        style={{
          width: `${(stadiumData.maxRx + 50) * 2}px`,
          height: `${(stadiumData.maxRy + 50) * 2}px`,
          transform: `scale(${scale})`,
        }}
      >
        <div
          className="absolute text-white/[0.08] font-black tracking-[1em] pl-[1em] text-6xl uppercase pointer-events-none select-none transition-all duration-300"
          style={{ top: `calc(50% - ${stadiumData.maxRy + 40}px)`, left: "50%", transform: "translate(-50%, -50%)" }}
        >
          Nord
        </div>
        <div
          className="absolute text-white/[0.08] font-black tracking-[1em] pl-[1em] text-6xl uppercase pointer-events-none select-none transition-all duration-300"
          style={{ top: `calc(50% + ${stadiumData.maxRy + 40}px)`, left: "50%", transform: "translate(-50%, -50%)" }}
        >
          Sud
        </div>
        <div
          className="absolute text-white/[0.08] font-black tracking-[1em] pl-[1em] text-6xl uppercase pointer-events-none select-none transition-all duration-300"
          style={{ top: "50%", left: `calc(50% - ${stadiumData.maxRx + 40}px)`, transform: "translate(-50%, -50%) rotate(-90deg)" }}
        >
          Ouest
        </div>
        <div
          className="absolute text-white/[0.08] font-black tracking-[1em] pl-[1em] text-6xl uppercase pointer-events-none select-none transition-all duration-300"
          style={{ top: "50%", left: `calc(50% + ${stadiumData.maxRx + 40}px)`, transform: "translate(-50%, -50%) rotate(90deg)" }}
        >
          Est
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[220px] bg-[#1a532d] border-[3px] border-white/90 flex items-center justify-center z-0 shadow-[0_0_80px_rgba(22,163,74,0.3)]">
          <div className="absolute inset-0 flex flex-col opacity-20 pointer-events-none">
            {[...Array(11)].map((_, i) => (
              <div key={i} className={`flex-1 w-full ${i % 2 === 0 ? "bg-white" : "bg-transparent"}`} />
            ))}
          </div>
          <div className="absolute h-full w-[2px] bg-white/70 left-1/2 -translate-x-1/2 shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
          <div className="absolute w-[60px] h-[60px] border-[2px] border-white/70 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
          <div className="absolute w-[4px] h-[4px] bg-white/90 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[54px] h-[100px] border-[2px] border-white/70 border-l-0 flex items-center shadow-[0_0_4px_rgba(255,255,255,0.5)]">
            <div className="w-[18px] h-[46px] border-[2px] border-white/70 border-l-0 absolute left-0" />
            <div className="w-[3px] h-[3px] bg-white/90 rounded-full absolute right-[10px]" />
            <div className="w-[30px] h-[40px] border-[2px] border-white/70 rounded-full absolute -right-[15px] clip-half-right opacity-60" />
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[54px] h-[100px] border-[2px] border-white/70 border-r-0 flex items-center justify-end shadow-[0_0_4px_rgba(255,255,255,0.5)]">
            <div className="w-[18px] h-[46px] border-[2px] border-white/70 border-r-0 absolute right-0" />
            <div className="w-[3px] h-[3px] bg-white/90 rounded-full absolute left-[10px]" />
            <div className="w-[30px] h-[40px] border-[2px] border-white/70 rounded-full absolute -left-[15px] clip-half-left opacity-60" />
          </div>
        </div>

        {seats.map((seat) => {
          const isSelected = selectedSeats.some((s) => s.id === seat.id);
          const isOccupied = seat.status !== "available";
          const zoneInfo = ZONE_META[seat.zone];
          if (!zoneInfo) return null;
          const isFilteredOut = zoneFilter && seat.zone !== zoneFilter;

          const statusColor = isOccupied ? "bg-gray-500/30 border-gray-600/30" : "";

          return (
            <div
              key={seat.id}
              className={`absolute transition-all duration-200 flex items-end justify-center pb-[2px]
                w-[14px] h-[16px] rounded-t-[4px] rounded-b-[2px] border-t-[4px] border-x-[1px] border-b-[1px]
                ${isOccupied && !isSelected ? `${statusColor} cursor-not-allowed opacity-60` : "cursor-pointer"}
                ${isFilteredOut && !isSelected ? `${zoneInfo.seatBg} ${zoneInfo.seatBorder} opacity-20 pointer-events-none scale-90 grayscale` : ""}
                ${!isOccupied && !isSelected && !isFilteredOut ? `${zoneInfo.seatBg} ${zoneInfo.seatBorder} opacity-90 hover:opacity-100 hover:scale-[2] hover:z-30` : ""}
                ${isSelected ? `${zoneInfo.seatBg} border-white ring-2 ring-white scale-[2] z-30 ${zoneInfo.shadow}` : ""}
              `}
              style={{
                left: `calc(50% + ${seat.x}px)`,
                top: `calc(50% + ${seat.y}px)`,
                transform: `translate(-50%, -50%) rotate(${seat.rotation}deg)`,
                boxShadow: isOccupied || isFilteredOut ? "none" : "inset 0 -2px 4px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)",
              }}
              onMouseEnter={() => !isOccupied && !isFilteredOut && setHoveredSeat(seat)}
              onMouseLeave={() => setHoveredSeat(null)}
              onClick={() => !isFilteredOut && !isOccupied && onToggleSeat(seat)}
            >
              {!isOccupied && <div className="w-[10px] h-[8px] bg-black/15 rounded-sm" />}
            </div>
          );
        })}

        {hoveredSeat && (() => {
          const zi = ZONE_META[hoveredSeat.zone];
          if (!zi) return null;
          return (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: `calc(50% + ${hoveredSeat.x}px)`,
                top: `calc(50% + ${hoveredSeat.y}px)`,
                transform: hoveredSeat.x > 0 ? "translate(6px, calc(-100% - 6px))" : "translate(calc(-100% - 6px), calc(-100% - 6px))",
              }}
            >
              <div className="bg-gray-900/95 backdrop-blur-sm text-white px-5 py-3.5 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-gray-700/50 flex flex-col items-center min-w-[150px]">
                <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1.5">Tribune {hoveredSeat.section}</div>
                <div className="text-base font-medium mb-2.5 whitespace-nowrap">Rang {hoveredSeat.row} · Place {hoveredSeat.num}</div>
                <div className={`text-sm px-2.5 py-1 rounded-sm font-bold ${zi.color} text-white`}>
                  {zi.name}, {zi.price}€
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
