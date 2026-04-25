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

export function flagInfo(code: string): { iso: string; name: string; url: string } {
  const hit = ISO[code] ?? { iso: "un", name: code };
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
