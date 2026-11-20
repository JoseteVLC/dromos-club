"use client";

import { useState } from "react";
import { deleteWodsRange } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";

/** Coach: borrar de golpe todas las partes de un día o de una semana (pide confirmación). */
export function DeleteDays({ date, monday, sunday, dayCount, weekCount }: { date: string; monday: string; sunday: string; dayCount: number; weekCount: number }) {
  const { t } = useI18n();
  const [ask, setAsk] = useState<"day" | "week" | null>(null);
  if (!dayCount && !weekCount) return null;
  const n = ask === "week" ? weekCount : dayCount;

  return (
    <div className="card space-y-3 border-red-500/30 p-4" data-noswipe>
      {ask ? (
        <form action={deleteWodsRange} className="space-y-3">
          <input type="hidden" name="from" value={ask === "week" ? monday : date} />
          <input type="hidden" name="to" value={ask === "week" ? sunday : date} />
          <input type="hidden" name="back" value={`/dia/${date}`} />
          <p className="text-sm">
            {ask === "week"
              ? t("¿Borrar toda la semana? Se borran {n} partes y los resultados que haya apuntados. No se puede deshacer.", { n })
              : t("¿Borrar todo el día? Se borran {n} partes y los resultados que haya apuntados. No se puede deshacer.", { n })}
          </p>
          <div className="flex gap-2">
            <button className="btn flex-1 bg-red-600 text-white">{t("Sí, borrar")}</button>
            <button type="button" onClick={() => setAsk(null)} className="btn-ghost flex-1">
              {t("Cancelar")}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={!dayCount} onClick={() => setAsk("day")} className="btn-ghost flex-1 text-sm text-red-400 disabled:opacity-30">
            {t("Borrar este día")}
          </button>
          <button type="button" disabled={!weekCount} onClick={() => setAsk("week")} className="btn-ghost flex-1 text-sm text-red-400 disabled:opacity-30">
            {t("Borrar esta semana")}
          </button>
        </div>
      )}
    </div>
  );
}
