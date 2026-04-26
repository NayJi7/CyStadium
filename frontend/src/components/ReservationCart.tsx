"use client";

import React from "react";
import Link from "next/link";
import { Check, ShoppingCart, Ticket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ZONE_META } from "./ZoneSelector";
import type { Seat } from "./SeatMap";

type Props = {
  selected: Seat[];
  onRemove: (seatId: string) => void;
  totalPrice: number;
  session: string | null;
  max?: number;
  onConfirm?: () => void;
};

export function ReservationCart({ selected, onRemove, totalPrice, session, max = 8, onConfirm }: Props) {
  if (selected.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 px-5 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/[0.06] text-white/25 text-center">
        <Ticket size={24} className="opacity-50 text-cyan-400" />
        <span className="text-base">Cliquez sur les sièges</span>
        <span className="text-xs text-white/20">Max {max} places</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/[0.08] shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <ShoppingCart size={20} className="text-cyan-400" />
          <span className="text-base font-semibold text-white/80">
            {selected.length}/{max}
          </span>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/40 uppercase tracking-wider">Total</div>
          <div className="text-2xl font-black text-white leading-tight">{totalPrice}€</div>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-4 pb-2">
        {selected.map((seat) => {
          const zone = ZONE_META[seat.zone];
          if (!zone) return null;
          return (
            <div
              key={seat.id}
              className="flex items-center gap-3 bg-white/5 border border-white/[0.08] rounded-lg px-4 py-2.5 text-base whitespace-nowrap hover:border-white/20 transition-colors group"
            >
              <div className={`w-2 h-5 rounded-full ${zone.color} flex-shrink-0`} />
              <span className="text-gray-200 flex-1">
                {seat.section} · R{seat.row} P{seat.num}
              </span>
              <span className="text-white/60 font-medium">{zone.price}€</span>
              <button onClick={() => onRemove(seat.id)} className="text-white/30 hover:text-red-400 transition-colors ml-1">
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-4 pb-4 pt-2">
        <Button className="w-full" size="sm" disabled={selected.length === 0 || !session} title={!session ? "Connexion requise" : undefined} onClick={onConfirm}>
          <Check size={15} aria-hidden /> Confirmer ({totalPrice}€)
        </Button>
        {!session && (
          <p className="text-center text-xs text-white/30 mt-1.5">
            <Link href="/login" className="text-cyan-300 hover:underline">
              Se connecter
            </Link>{" "}
            pour finaliser
          </p>
        )}
      </div>
    </div>
  );
}
