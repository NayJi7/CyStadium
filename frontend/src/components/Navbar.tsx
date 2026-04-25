"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const links = [
  { href: "/matches",      label: "Matchs" },
  { href: "/reservations", label: "Mes réservations" },
  { href: "/admin",        label: "Admin" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
            <span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-cyan-400/30 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <Image
              src="/logo.png"
              alt="CyStadium"
              width={36}
              height={36}
              priority
            />
          </span>
          <span className="heading-display text-xl text-white hidden sm:inline">
            Cy<span className="text-cyan-400">Stadium</span>
          </span>
        </Link>
        <ul className="flex items-center gap-1">
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "relative px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150",
                    active
                      ? "text-cyan-300"
                      : "text-white/60 hover:text-white hover:bg-white/5",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                    />
                  )}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/login"
              className="ml-2 inline-flex h-9 items-center rounded-md bg-cyan-400 px-4 text-sm font-semibold text-navy-900 shadow-glow transition-all duration-150 hover:bg-cyan-300 hover:shadow-glow-lg"
            >
              Se connecter
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
