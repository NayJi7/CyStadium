// Types partagés pour les matchs côté frontend.
// Les données viennent désormais de l'API (GET /api/matches).
// Ce fichier ne contient plus de données en dur.

export type MatchInfo = {
  id: string;
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