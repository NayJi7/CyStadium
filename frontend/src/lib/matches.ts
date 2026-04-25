// Source de vérité unique pour les matchs côté frontend.
//
// L'URL utilise un slug court (ex. /matches/fra-bra) tandis que le backend
// continue d'attendre l'UUID. `byUuid` est gardé pour les flux qui partent
// déjà d'un UUID (events WebSocket, etc.).

export type MatchInfo = {
  slug: string;
  uuid: string;
  home: string;
  away: string;
  date: string;
  stadium: string;
  city: string;
  stage: string;
  hero: string;
  zones: { VIP: number; Or: number; Standard: number; Populaire: number };
  highlight?: boolean;
};

export const MATCHES: MatchInfo[] = [
  {
    slug: "fra-bra",
    uuid: "11111111-1111-1111-1111-111111111111",
    home: "FRA",
    away: "BRA",
    date: "14 juin 2026 · 21:00",
    stadium: "Stade de France",
    city: "Saint-Denis",
    stage: "Finale",
    hero: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1920&q=75",
    zones: { VIP: 12, Or: 84, Standard: 320, Populaire: 650 },
    highlight: true,
  },
  {
    slug: "ger-esp",
    uuid: "22222222-2222-2222-2222-222222222222",
    home: "GER",
    away: "ESP",
    date: "15 juin 2026 · 18:00",
    stadium: "Allianz Arena",
    city: "Munich",
    stage: "Demi-finale",
    hero: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&q=75",
    zones: { VIP: 5, Or: 42, Standard: 180, Populaire: 290 },
  },
  {
    slug: "arg-por",
    uuid: "33333333-3333-3333-3333-333333333333",
    home: "ARG",
    away: "POR",
    date: "16 juin 2026 · 21:00",
    stadium: "Wembley",
    city: "Londres",
    stage: "Demi-finale",
    hero: "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1920&q=75",
    zones: { VIP: 0, Or: 18, Standard: 95, Populaire: 420 },
  },
  {
    slug: "eng-ned",
    uuid: "44444444-4444-4444-4444-444444444444",
    home: "ENG",
    away: "NED",
    date: "17 juin 2026 · 20:00",
    stadium: "Santiago Bernabéu",
    city: "Madrid",
    stage: "Quarts",
    hero: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1920&q=75",
    zones: { VIP: 18, Or: 96, Standard: 240, Populaire: 540 },
  },
  {
    slug: "ita-uru",
    uuid: "55555555-5555-5555-5555-555555555555",
    home: "ITA",
    away: "URU",
    date: "18 juin 2026 · 18:00",
    stadium: "San Siro",
    city: "Milan",
    stage: "Quarts",
    hero: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1920&q=75",
    zones: { VIP: 22, Or: 110, Standard: 280, Populaire: 620 },
  },
  {
    slug: "mar-sen",
    uuid: "66666666-6666-6666-6666-666666666666",
    home: "MAR",
    away: "SEN",
    date: "19 juin 2026 · 21:00",
    stadium: "Maracanã",
    city: "Rio de Janeiro",
    stage: "Quarts",
    hero: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1920&q=75",
    zones: { VIP: 30, Or: 140, Standard: 360, Populaire: 890 },
  },
];

export function findMatch(slugOrUuid: string): MatchInfo | undefined {
  return MATCHES.find((m) => m.slug === slugOrUuid || m.uuid === slugOrUuid);
}
