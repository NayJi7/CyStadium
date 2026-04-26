"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import { clearSession, getSession, SESSION_EVENT, type SessionInfo } from "@/lib/session";
import { avatarUrl } from "@/lib/avatar";

type NavLink = { href: string; label: string };

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [session, setSessionState] = useState<SessionInfo | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sync = () => setSessionState(getSession());
    sync();
    setHydrated(true);
    window.addEventListener(SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleLogout = async () => {
    if (session) {
      try { await api.logout(session.sessionId); } catch { /* ignore */ }
    }
    clearSession();
    router.push("/");
  };

  const links: NavLink[] = (() => {
    if (!session) return [{ href: "/matches", label: "Matchs" }];
    const base: NavLink[] = [
      { href: "/matches",      label: "Matchs" },
      { href: "/reservations", label: "Mes réservations" },
    ];
    if (session.isAdmin) base.push({ href: "/admin", label: "Admin" });
    return base;
  })();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled
          ? "border-b border-white/10 bg-navy-950/80 backdrop-blur-xl"
          : "border-b border-transparent bg-navy-900/40 backdrop-blur-md",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-3">
          <span className="relative">
            <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-cyan-400/30 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <Image src="/logo.png" alt="CyStadium" width={36} height={36} priority />
          </span>
          <span className="heading-display text-xl text-white hidden sm:inline">
            Cy<span className="text-cyan-400">Stadium</span>
          </span>
        </Link>

        <ul className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "relative px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150",
                    active ? "text-cyan-300" : "text-white/60 hover:text-white hover:bg-white/5",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                  {active && (
                    <span aria-hidden className="absolute inset-x-3 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                  )}
                </Link>
              </li>
            );
          })}

          {hydrated && (session ? (
            <li className="ml-4 flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="flex items-center gap-2.5 text-sm" title={`Connecté · ${session.username}`}>
                <span className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl(session.clientId, 72)}
                    alt={session.username}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full ring-2 ring-cyan-400/40"
                  />
                  {session.isAdmin && (
                    <span
                      aria-label="Admin"
                      className="absolute -bottom-0.5 -right-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold-400 text-[9px] font-black text-navy-900 ring-2 ring-navy-950"
                    >
                      ★
                    </span>
                  )}
                </span>
                <span className="font-semibold text-white/90">{session.username}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                <LogOut size={16} />
              </button>
            </li>
          ) : (
            <li>
              <Link
                href="/login"
                className="ml-2 inline-flex h-9 items-center rounded-md bg-cyan-400 px-4 text-sm font-semibold text-navy-900 shadow-glow transition-all duration-150 hover:bg-cyan-300 hover:shadow-glow-lg"
              >
                Se connecter
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
