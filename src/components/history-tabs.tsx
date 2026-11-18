import Link from "next/link";
import type { T } from "@/lib/i18n/core";

/** Pestañas de la sección Historial: resultados de WODs y marcas personales. */
export function HistoryTabs({ active, t }: { active: "results" | "marcas"; t: T }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-line p-1">
      {(
        [
          ["results", "/historial", t("📈 Resultados")],
          ["marcas", "/marcas", t("🏋️ Mis marcas")],
        ] as const
      ).map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          replace
          className={`rounded-md py-2 text-center font-display text-lg font-bold uppercase ${active === key ? "bg-accent text-accent-fg" : "text-muted"}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
