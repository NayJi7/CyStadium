"use client";

import { motion } from "framer-motion";

// Fond "aurora" GPU-only : 3 blobs flous en blend-screen qui dérivent lentement.
// Zéro CPU, pas de requestAnimationFrame manuel.

export function AuroraBackground({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      {/* Base grid subtle */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #22d3ee 1px, transparent 1px)," +
            "linear-gradient(to bottom, #22d3ee 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      {/* Blob cyan */}
      <motion.div
        className="absolute -top-32 -left-32 h-[620px] w-[620px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)", mixBlendMode: "screen" }}
        animate={{ x: [0, 120, -40, 80, 0], y: [0, 60, 140, 40, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Blob indigo */}
      <motion.div
        className="absolute top-40 right-[-200px] h-[560px] w-[560px] rounded-full blur-[110px]"
        style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", mixBlendMode: "screen" }}
        animate={{ x: [0, -150, -40, -120, 0], y: [0, 80, -40, 60, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Blob gold, échos du trophée */}
      <motion.div
        className="absolute bottom-[-240px] left-1/3 h-[640px] w-[640px] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)", mixBlendMode: "screen", opacity: 0.6 }}
        animate={{ x: [0, 80, -60, 40, 0], y: [0, -40, 80, -20, 0] }}
        transition={{ duration: 36, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Vignette pour lisibilité */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(5,15,34,0.75)_100%)]" />
    </div>
  );
}
