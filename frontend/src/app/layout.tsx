import type { Metadata } from "next";
import { Bebas_Neue, Source_Sans_3 } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { SessionExpiredBanner } from "@/components/SessionExpiredBanner";
import "./globals.css";

const display = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CyStadium, Secure your seat. Instantly.",
  description:
    "Réservez votre place pour les matchs de la Coupe du Monde. Temps réel, paiement sécurisé, zéro surbooking.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable} dark`}>
      <body className="font-sans antialiased text-white min-h-dvh flex flex-col bg-[#050F22]">
        <div 
          className="pointer-events-none fixed inset-0 z-0 opacity-25"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1920&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            filter: 'grayscale(0.6) contrast(1.2)'
          }}
        >
          {/* Lighter vignette overlay so the image shows through */}
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/40 via-navy-950/20 to-navy-950/90" />
        </div>
        
        <div className="relative z-10 flex min-h-dvh flex-col">
          <SessionExpiredBanner />
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="relative bg-navy-950/30 backdrop-blur-md border-t border-white/5 py-6 text-center text-xs text-white/40">
            <span className="relative z-50">CyStadium · CY Tech · Coupe du Monde 2026</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
