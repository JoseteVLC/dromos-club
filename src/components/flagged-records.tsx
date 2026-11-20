import Link from "next/link";
import { deleteFlaggedRecord, markRecordOk } from "@/app/actions";
import { Avatar } from "./avatar";
import { ConfirmDelete } from "./ui";
import { formatScore } from "@/lib/scoring";
import type { Result, ScoreType } from "@/lib/types";
import type { T } from "@/lib/i18n/core";
import { Icon } from "@/components/icon";

export type FlaggedRecord = Result & {
  rm: number | null;
  performed_on: string | null;
  flag: string | null;
  benchmarks: { name: string; score_type: ScoreType } | null;
  profiles: { id: string; full_name: string; avatar_url: string | null } | null;
};

/** Coach → marcas personales que el detector ve imposibles y el atleta ha confirmado. */
export function FlaggedRecords({ rows, t }: { rows: FlaggedRecord[]; t: T }) {
  if (!rows.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="alert" size={20} tile /> {t("Marcas a revisar")} · {rows.length}</h2>
      <p className="text-sm text-muted">{t("Marcas personales imposibles que el atleta ha confirmado igualmente. Si no son reales, bórralas.")}</p>
      <ul className="card divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={r.profiles?.full_name} url={r.profiles?.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <Link href={`/atleta/${r.user_id}`} className="block truncate font-semibold">{r.profiles?.full_name}</Link>
                <div className="truncate text-xs text-muted">
                  {r.benchmarks?.name}
                  {r.rm && r.rm > 1 ? ` · ${r.rm}RM` : ""}
                  {r.performed_on ? ` · ${r.performed_on}` : ""}
                </div>
              </div>
              <div className="h-display shrink-0 text-lg text-alert">{r.benchmarks ? formatScore({ score_type: r.benchmarks.score_type, score_label: null }, r) : ""}</div>
            </div>
            <p className="text-sm">{r.flag}</p>
            <div className="flex items-center justify-end gap-3">
              <form action={deleteFlaggedRecord}>
                <input type="hidden" name="id" value={r.id} />
                <ConfirmDelete label={t("Borrar marca")} className="text-sm" />
              </form>
              <form action={markRecordOk}>
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
