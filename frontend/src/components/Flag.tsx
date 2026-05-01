import Image from "next/image";
import { cn } from "@/lib/cn";

// Code ISO 3166-1 alpha-2 en minuscule pour flagcdn.com
const ISO: Record<string, { iso: string; name: string }> = {
  FRA: { iso: "fr", name: "France" },
  BRA: { iso: "br", name: "Brésil" },
  GER: { iso: "de", name: "Allemagne" },
  ESP: { iso: "es", name: "Espagne" },
  ARG: { iso: "ar", name: "Argentine" },
  POR: { iso: "pt", name: "Portugal" },
  ENG: { iso: "gb-eng", name: "Angleterre" },
  NED: { iso: "nl", name: "Pays-Bas" },
  ITA: { iso: "it", name: "Italie" },
  URU: { iso: "uy", name: "Uruguay" },
  CRO: { iso: "hr", name: "Croatie" },
  BEL: { iso: "be", name: "Belgique" },
  JPN: { iso: "jp", name: "Japon" },
  KOR: { iso: "kr", name: "Corée du Sud" },
  MAR: { iso: "ma", name: "Maroc" },
  SEN: { iso: "sn", name: "Sénégal" },
  USA: { iso: "us", name: "États-Unis" },
  CAN: { iso: "ca", name: "Canada" },
  MEX: { iso: "mx", name: "Mexique" },
};

// Reverse lookup : noms complets (français/anglais) → code 3 lettres
const NAME_TO_CODE: Record<string, string> = {
  "France": "FRA", "Brésil": "BRA", "Bresil": "BRA", "Brazil": "BRA",
  "Allemagne": "GER", "Germany": "GER",
  "Espagne": "ESP", "Spain": "ESP",
  "Argentine": "ARG", "Argentina": "ARG",
  "Portugal": "POR",
  "Angleterre": "ENG", "England": "ENG",
  "Pays-Bas": "NED", "Netherlands": "NED",
  "Italie": "ITA", "Italy": "ITA",
  "Uruguay": "URU",
  "Croatie": "CRO", "Croatia": "CRO",
  "Belgique": "BEL", "Belgium": "BEL",
  "Japon": "JPN", "Japan": "JPN",
  "Corée du Sud": "KOR", "South Korea": "KOR",
  "Maroc": "MAR", "Morocco": "MAR",
  "Sénégal": "SEN", "Senegal": "SEN",
  "États-Unis": "USA", "United States": "USA",
  "Canada": "CAN",
  "Mexique": "MEX", "Mexico": "MEX",
};

export function flagInfo(code: string): { iso: string; name: string; url: string } {
  const resolved = NAME_TO_CODE[code] ?? code;
  const hit = ISO[resolved] ?? { iso: "un", name: code };
  return {
    ...hit,
    url: `https://flagcdn.com/w160/${hit.iso}.png`,
  };
}

export function Flag({
  code,
  size = 28,
  className,
  rounded = true,
}: {
  code: string;
  size?: number;
  className?: string;
  rounded?: boolean;
}) {
  const { iso, name, url } = flagInfo(code);
  return (
    <Image
      src={url}
      alt={name}
      width={size * 2}
      height={Math.round(size * 1.33)}
      className={cn(
        "inline-block shadow-md ring-1 ring-white/10",
        rounded ? "rounded-sm" : "",
        className
      )}
      unoptimized
      // fallback visible si flagcdn n'a pas le code (ex: un)
      data-iso={iso}
    />
  );
}
