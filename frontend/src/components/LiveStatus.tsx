"use client";

import React, { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { openLiveSocket, type LiveEvent } from "@/lib/api";

type Props = {
  matchId: string;
  onSeatStatus?: (seatId: string, status: LiveEvent["status"]) => void;
  className?: string;
};

export function LiveStatus({ matchId, onSeatStatus, className }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Only connect with a valid UUID, not a slug
    if (!matchId || !matchId.match(/^[0-9a-f]{8}-/)) return;
    let sock: WebSocket | null = null;
    try {
      sock = openLiveSocket(matchId, (ev) => {
        setCount((n) => n + 1);
        onSeatStatus?.(ev.seat_id, ev.status);
      });
    } catch {
      // ignore, backend may be offline
    }
    return () => sock?.close();
  }, [matchId, onSeatStatus]);

  return (
    <span
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300"
      }
    >
      <Radio size={12} className="animate-pulse" aria-hidden />
      Live · {count}
    </span>
  );
}
