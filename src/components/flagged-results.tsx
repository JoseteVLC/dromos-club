import Link from "next/link";
import { deleteResult, markResultOk } from "@/app/actions";
import { Avatar } from "./avatar";
import { ConfirmDelete } from "./ui";
import { formatScore } from "@/lib/scoring";
import { dayHref } from "@/lib/dates";
import type { Result, Wod } from "@/lib/types";
import type { T } from "@/lib/i18n/core";
import { Icon } from "@/components/icon";

export type FlaggedRow = Result & {
  wods: Pick<Wod, "id" | "title" | "part" | "wod_date" | "score_type" | "score_label">;
  profiles: { full_name: string; gender: "M" | "F" | null; avatar_url: string | null } | null;
};

/** Coach → resultados que el detector ve imposibles, para confirmarlos o borrarlos antes del cierre de medallas. */
export function FlaggedResults({ rows, t }: { rows: FlaggedRow[]; t: T }) {
  if (!rows.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="alert" size={20} tile /> {t("Resultados a revisar")} · {rows.length}</h2>
      <p className="text-sm text-muted">{t("Resultados que superan un récord mundial y el atleta ha confirmado igualmente. Revísalos antes de que cierre el WOD (2 días): mientras tanto no cuentan para las medallas.")}</p>
      <ul className="card divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={r.profiles?.full_name} url={r.profiles?.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.profiles?.full_name}</div>
                <Link href={dayHref(r.wods.wod_date, { w: r.wods.id })} className="truncate text-xs text-muted underline">
                  {r.wods.wod_date} · {r.wods.part} {r.wods.title}
                </Link>
              </div>
              <div className="h-display shrink-0 text-lg text-alert">{formatScore(r.wods, r)}</div>
            </div>
            <p className="text-sm">{r.flag}</p>
            <div className="flex items-center justify-end gap-3">
              <form action={deleteResult}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="back" value="/coach" />
                <ConfirmDelete label={t("Borrar resultado")} className="text-sm" />
              </form>
              <form action={markResultOk}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn px-3 py-2 text-sm">{t("Es correcto")}</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
