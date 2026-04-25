"use client";

// Trophée SVG inspiré du FIFA World Cup : globe sur deux colonnes torsadées + socle.
// Gradient or + highlights pour effet 3D, glow cyan en arrière pour raccord avec la marque.

type Props = {
  className?: string;
  size?: number;
};

export function Trophy({ className, size = 420 }: Props) {
  return (
    <svg
      viewBox="0 0 400 520"
      width={size}
      height={size * (520 / 400)}
      className={className}
      aria-label="Coupe du Monde"
      role="img"
    >
      <defs>
        <linearGradient id="gold-main" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#FDE68A" />
          <stop offset="25%"  stopColor="#FBBF24" />
          <stop offset="55%"  stopColor="#D97706" />
          <stop offset="85%"  stopColor="#B45309" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
        <linearGradient id="gold-highlight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#FEF3C7" stopOpacity="0" />
          <stop offset="45%"  stopColor="#FEF3C7" stopOpacity="0.9" />
          <stop offset="55%"  stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="65%"  stopColor="#FEF3C7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="globe-sheen" cx="35%" cy="30%" r="60%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="35%"  stopColor="#FDE68A" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="base-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#B45309" />
          <stop offset="50%"  stopColor="#78350F" />
          <stop offset="100%" stopColor="#451A03" />
        </linearGradient>

        <filter id="trophy-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Halo cyan derrière */}
      <circle cx="200" cy="200" r="170" fill="#22D3EE" opacity="0.12" filter="url(#trophy-glow)" />

      {/* ── Globe / coupe (partie haute) ─────────────────────────────── */}
      <g filter="url(#trophy-glow)">
        {/* Sphère */}
        <ellipse cx="200" cy="180" rx="92" ry="96" fill="url(#gold-main)" />
        <ellipse cx="200" cy="180" rx="92" ry="96" fill="url(#globe-sheen)" />

        {/* Continents stylisés (traces) */}
        <path
          d="M160 135 Q180 150 170 175 T 175 210 Q 195 230 225 215 T 255 185 Q 245 155 220 140 T 160 135"
          fill="#92400E"
          opacity="0.45"
        />
        <path
          d="M145 195 Q 160 220 190 235 Q 170 218 165 195 Z"
          fill="#92400E"
          opacity="0.35"
        />

        {/* Anneau de lumière sur le haut */}
        <ellipse cx="200" cy="140" rx="60" ry="10" fill="url(#gold-highlight)" opacity="0.7" />

        {/* ── Colonnes torsadées qui montent vers la coupe ────────────── */}
        <path
          d="M170 255 Q 165 290 175 325 Q 185 355 175 385"
          stroke="url(#gold-main)"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M230 255 Q 235 290 225 325 Q 215 355 225 385"
          stroke="url(#gold-main)"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
        />
        {/* Highlights fins sur colonnes */}
        <path
          d="M167 260 Q 163 295 172 325"
          stroke="#FEF3C7"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M232 260 Q 236 295 228 325"
          stroke="#FEF3C7"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />

        {/* Socle supérieur */}
        <rect x="140" y="380" width="120" height="22" rx="4" fill="url(#gold-main)" />
        <rect x="140" y="380" width="120" height="5" fill="url(#gold-highlight)" opacity="0.5" />

        {/* Socle inférieur (marbre foncé / bronze) */}
        <rect x="120" y="402" width="160" height="40" rx="6" fill="url(#base-grad)" />
        <rect x="120" y="402" width="160" height="3" fill="#FEF3C7" opacity="0.3" />
        <rect x="110" y="442" width="180" height="18" rx="4" fill="url(#base-grad)" />
      </g>

      {/* Reflet diagonal qui traverse (animé en CSS via parent) */}
      <rect x="0" y="0" width="400" height="520" fill="url(#gold-highlight)" opacity="0.15" />
    </svg>
  );
}
