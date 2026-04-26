// Génère une URL d'avatar SVG via DiceBear (free, no auth).
// Seed stable = clientId UUID → même avatar à chaque connexion.
// Style "big-smile" : personnages colorés joyeux, plus mignons et expressifs.

const STYLE = "big-smile";

export function avatarUrl(seed: string, size: number = 64): string {
  const s = encodeURIComponent(seed);
  return `https://api.dicebear.com/9.x/${STYLE}/svg?seed=${s}&size=${size}&backgroundType=gradientLinear&backgroundColor=22d3ee,a78bfa,fbbf24,f472b6&backgroundRotation=0,360`;
}
