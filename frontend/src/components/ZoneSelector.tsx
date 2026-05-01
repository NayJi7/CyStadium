"use client";

import React from "react";

export const ZONE_ORDER = ["VIP", "Or", "Standard", "Populaire"] as const;
export type Zone = (typeof ZONE_ORDER)[number];

export const ZONE_META: Record<
  Zone,
  { id: string; name: Zone; price: number; color: string; seatBg: string; seatBorder: string; shadow: string }
> = {
  Populaire: { id: "populaire", name: "Populaire", price: 50,   color: "bg-emerald-400",  seatBg: "bg-emerald-400",  seatBorder: "border-emerald-600",  shadow: "shadow-emerald-400/50" },
  Standard:  { id: "standard",  name: "Standard",  price: 100,  color: "bg-blue-400",     seatBg: "bg-blue-400",     seatBorder: "border-blue-600",     shadow: "shadow-blue-400/50" },
  Or:        { id: "or",        name: "Or",        price: 250,  color: "bg-gold-400",     seatBg: "bg-gold-400",     seatBorder: "border-gold-600",     shadow: "shadow-gold-400/50" },
  VIP:       { id: "vip",       name: "VIP",       price: 500,  color: "bg-fuchsia-500",  seatBg: "bg-fuchsia-500",  seatBorder: "border-fuchsia-700",  shadow: "shadow-fuchsia-500/50" },
};

type Props = {
  selected: Zone | null;
  onChange: (z: Zone | null) => void;
  availability?: Record<string, number>;
  className?: string;
};

export function ZoneSelector({ selected, onChange, availability, className }: Props) {
  return (
    <div className={className ?? "flex flex-col gap-2"}>
      {(["Populaire", "Standard", "Or", "VIP"] as Zone[]).map((zoneKey) => {
        const zone = ZONE_META[zoneKey];
        const isActive = selected === zone.name;
        const avail = availability?.[zone.name];
        const soldOut = avail !== undefined && avail === 0;
        return (
          <button
            key={zone.id}
            disabled={soldOut}
            className={`flex items-center gap-3 text-base px-4 py-2 rounded-lg cursor-pointer transition-all text-left ${
              soldOut
                ? "opacity-40 cursor-not-allowed bg-white/[0.02]"
                : isActive
                ? "ring-2 ring-white/50 bg-white/10 backdrop-blur-sm"
                : "bg-white/[0.04] backdrop-blur-sm hover:bg-white/10"
            }`}
            onClick={() => !soldOut && onChange(isActive ? null : zone.name)}
          >
            <div className={`w-6 h-7 flex-shrink-0 rounded-t-[7px] rounded-b-[3px] border-t-[5px] border-x-2 border-b-2 ${zone.seatBg} ${zone.seatBorder}`} />
            <span className="text-gray-200 font-medium flex-1">
              {zone.name} <span className="text-gray-500">({zone.price}€)</span>
            </span>
            {avail !== undefined && (
              <span className={`text-xs tabular-nums font-mono ${soldOut ? "text-red-400/60" : "text-white/40"}`}>
                {avail}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
