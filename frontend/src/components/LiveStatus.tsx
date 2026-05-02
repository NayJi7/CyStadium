"use client";

import React, { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { openLiveSocket, type LiveEvent } from "@/lib/api";

type Props = {
  matchId?: string | null;
  onSeatStatus?: (seatId: string, status: "free" | "reserved" | "confirmed" | "locked") => void;
  onReservationCount?: (count: number) => void;
  className?: string;
};

export function LiveStatus({ matchId, onSeatStatus, onReservationCount, className }: Props) {
  const [reservationCount, setReservationCount] = useState<number | null>(null);
  const onSeatStatusRef = useRef(onSeatStatus);
  const onReservationCountRef = useRef(onReservationCount);
  onSeatStatusRef.current = onSeatStatus;
  onReservationCountRef.current = onReservationCount;

  useEffect(() => {
    if (!matchId) return;
    let sock: WebSocket | null = null;
    try {
      sock = openLiveSocket(matchId, (ev) => {
        if (ev.type === "reservation_count") {
          setReservationCount(ev.count);
          onReservationCountRef.current?.(ev.count);
        } else {
          onSeatStatusRef.current?.(ev.seat_id, ev.status);
        }
      });
    } catch {
      // backend may be offline
    }
    return () => sock?.close();
  }, [matchId]);

  const n = reservationCount ?? 0;

  return (
    <span
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300"
      }
    >
      <Radio size={12} className="animate-pulse" aria-hidden />
      Live · {n} r&eacute;serv{n > 1 ? "ations" : "ation"} en cours
    </span>
  );
}