import Link from "next/link";
import type { T } from "@/lib/i18n/core";

export type RankingMode = "points" | "racha" | "lb" | "medals";

/** Pestañas de la sección Ranking (las medallas también viven aquí). */
export function RankingTabs({ mode, t }: { mode: RankingMode; t: T }) {
  const tab = (m: RankingMode, href: string, label: string) => (
    <Link href={href as "/ranking"} replace className={`chip ${mode === m ? "chip-on" : ""}`}>{label}</Link>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {tab("points", "/ranking", `🏆 ${t("Puntos")}`)}
      {tab("racha", "/ranking?p=racha", `🔥 ${t("Constancia")}`)}
      {tab("lb", "/ranking?p=lb", `📋 ${t("Leaderboards")}`)}
      {tab("medals", "/medallas?desde=ranking", `🏅 ${t("Medallas")}`)}
    </div>
  );
}
