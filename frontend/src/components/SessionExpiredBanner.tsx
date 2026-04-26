"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SESSION_EVENT } from "@/lib/session";

export function SessionExpiredBanner() {
  const router = useRouter();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener("cystadium:session-expired", onExpired);
    // Si la session est déjà vidée par un autre onglet, on disparait
    window.addEventListener(SESSION_EVENT, () => {
      if (expired) setExpired(false);
    });
    return () => window.removeEventListener("cystadium:session-expired", onExpired);
  }, [expired]);

  if (!expired) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="mx-4 max-w-md rounded-2xl border border-white/10 bg-navy-900 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-400/30">
          <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Session expirée</h2>
        <p className="mt-2 text-sm text-white/60">
          Vous avez été déconnecté suite à une inactivité prolongée.
        </p>
        <button
          type="button"
          onClick={() => {
            setExpired(false);
            router.push("/login");
          }}
          className="mt-6 inline-flex h-11 items-center rounded-md bg-cyan-400 px-6 text-sm font-semibold text-navy-900 transition-colors hover:bg-cyan-300"
        >
          Se reconnecter
        </button>
      </div>
    </div>
  );
}