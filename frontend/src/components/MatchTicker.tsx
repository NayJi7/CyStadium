"use client";

const MATCHES = [
  { a: "FRA", b: "BRA", d: "14 juin" },
  { a: "GER", b: "ESP", d: "15 juin" },
  { a: "ARG", b: "POR", d: "16 juin" },
  { a: "ENG", b: "NED", d: "17 juin" },
  { a: "ITA", b: "URU", d: "18 juin" },
  { a: "CRO", b: "BEL", d: "19 juin" },
  { a: "JPN", b: "KOR", d: "20 juin" },
  { a: "MAR", b: "SEN", d: "21 juin" },
];

export function MatchTicker() {
  const doubled = [...MATCHES, ...MATCHES];
  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-navy-950/60 py-5">
      {/* Masques de fade sur les côtés */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-navy-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-navy-900 to-transparent" />

      <div className="flex w-max animate-marquee gap-6">
        {doubled.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-full border border-white/10 bg-navy-800/60 px-5 py-2 text-sm backdrop-blur-sm"
          >
            <span className="font-mono text-[11px] uppercase text-white/40">{m.d}</span>
            <span className="heading-display text-xl">{m.a}</span>
            <span className="text-[11px] font-semibold text-cyan-400">VS</span>
            <span className="heading-display text-xl">{m.b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
