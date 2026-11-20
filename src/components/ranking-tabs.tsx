import Link from "next/link";
import type { ReactNode } from "react";
import type { T } from "@/lib/i18n/core";
import { Icon } from "@/components/icon";

export type RankingMode = "points" | "racha" | "lb" | "medals";

/** Pestañas de la sección Ranking (las medallas también viven aquí). */
export function RankingTabs({ mode, t }: { mode: RankingMode; t: T }) {
  const tab = (m: RankingMode, href: string, label: ReactNode) => (
    <Link href={href as "/ranking"} replace className={`chip inline-flex items-center gap-1.5 ${mode === m ? "chip-on" : ""}`}>{label}</Link>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {tab("points", "/ranking", <><Icon name="trophy" size={15} /> {t("Puntos")}</>)}
      {tab("racha", "/ranking?p=racha", <><Icon name="flame" size={15} /> {t("Constancia")}</>)}
      {tab("lb", "/ranking?p=lb", <><Icon name="list" size={15} /> {t("Leaderboards")}</>)}
      {tab("medals", "/medallas?desde=ranking", <><Icon name="medal" size={15} /> {t("Medallas")}</>)}
    </div>
  );
}
