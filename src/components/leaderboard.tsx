import Link from "next/link";
import { Avatar } from "./avatar";
import { MIN_FOR_PERCENTILE, PercentileCard } from "./percentile-card";
import { formatScore, formatScore2, rankResults } from "@/lib/scoring";
import { RANKED_DIVISIONS, SCORE_TYPES, type Division, type Gender, type Result, type Wod } from "@/lib/types";
import { deleteResult } from "@/app/actions";
import { Reactions, type ReactionSummary } from "./reactions";
import { ConfirmDelete } from "./ui";
import { getI18n } from "@/lib/i18n/server";
import { closeDay, inTime, isClosed } from "@/lib/closing";
import { longDate } from "@/lib/dates";

const GENDERS: { value: Gender | "all"; label: string }[] = [
  { value: "all", label: "Absoluto" },
  { value: "M", label: "Chicos" },
  { value: "F", label: "Chicas" },
];

export async function Leaderboard({
  wod,
  results,
  userId,
  isCoach,
  gender,
  division,
  score = 1,
  href,
  reactions = {},
  comments = {},
}: {
  wod: Wod;
  results: Result[];
  userId: string;
  isCoach: boolean;
  gender: Gender | "all";
  division: Division | "all";
  /** 1 = score principal, 2 = segundo score (si el WOD lo tiene) */
  score?: 1 | 2;
  /** Construye la URL con los filtros elegidos */
  href: (g: string, d: string, s: 1 | 2) => string;
  reactions?: Record<string, ReactionSummary>;
  comments?: Record<string, number>;
}) {
  const ranked = rankResults(wod, results, { gender, division, score });
  const { t, locale } = await getI18n();
  const closed = isClosed(wod.wod_date);
  const byId = new Map(results.map((r) => [r.id, r]));
  // El otro score, en pequeño debajo del nombre
  const other = (id: string) => {
    const orig = byId.get(id);
    if (!orig || !wod.score2_type) return null;
    return score === 2 ? formatScore(wod, orig) : formatScore2(wod, orig);
  };
  const scoreName = (n: 1 | 2) =>
    n === 1
      ? wod.score_name || t(SCORE_TYPES[wod.score_type].label)
      : wod.score2_name || t(SCORE_TYPES[wod.score2_type!].label);
  const scaled =
    division === "all"
      ? results.filter((r) => r.division === "scaled" && (gender === "all" || r.profiles?.gender === gender))
      : [];

  return (
    <section id="leaderboard" className="scroll-mt-20 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="h-display text-3xl">Leaderboard</h2>
        <span className="text-xs text-muted">{results.length === 1 ? t("1 resultado") : t("{n} resultados", { n: results.length })}</span>
      </div>
      {wod.score2_type && (
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-bg p-1" data-noswipe>
          {([1, 2] as const).map((n) => (
            <Link
              key={n}
              href={href(gender, division, n)}
              scroll={false}
              replace
              className={`truncate rounded-md py-2 text-center text-sm font-bold transition ${score === n ? "bg-accent text-accent-fg" : "text-muted"}`}
            >
              {scoreName(n)}
            </Link>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2" data-noswipe>
        {GENDERS.map((g) => (
          <Link key={g.value} href={href(g.value, division, score)} scroll={false} replace className={`chip ${gender === g.value ? "chip-on" : ""}`}>
            {t(g.label)}
          </Link>
        ))}
        <span className="mx-1 w-px self-stretch bg-line" />
        {[{ value: "all", label: t("Todas") }, ...RANKED_DIVISIONS].map((d) => (
          <Link key={d.value} href={href(gender, d.value, score)} scroll={false} replace className={`chip ${division === d.value ? "chip-on" : ""}`}>
            {d.label}
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted">
        {closed
          ? t("🔒 Clasificación cerrada: las medallas de podio ya están repartidas.")
          : t("⏳ Clasificación provisional hasta el {day} a las 23:59. Lo que se meta después sale aquí, pero no cuenta para medallas.", {
              day: longDate(closeDay(wod.wod_date), locale),
            })}
      </p>

      {(() => {
        // Tu posición y percentil (solo lo ves tú), dentro del filtro elegido
        const mine = ranked.find((r) => r.user_id === userId);
        if (!mine) return null;
        const beat = ranked.filter((r) => r.rank > mine.rank).length;
        return (
          <PercentileCard
            rank={mine.rank}
            total={ranked.length}
            labels={{
              pos: t("{pos}º de {n}", { pos: mine.rank, n: ranked.length }),
              top: t("Superas al {beat}% de los atletas con este filtro.", { beat: Math.round((beat / Math.max(1, ranked.length - 1)) * 100) }),
              few: t("Tu posición. El percentil sale a partir de {min} atletas.", { min: MIN_FOR_PERCENTILE }),
            }}
          />
        );
      })()}

      {ranked.length === 0 ? (
        <p className="card p-6 text-center text-muted">{t("Aún no hay resultados con estos filtros.")}</p>
      ) : (
        <ol className="card divide-y divide-line overflow-hidden">
          {ranked.map((r) => {
            const me = r.user_id === userId;
            return (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${me ? "bg-accent/10" : ""}`}>
                <span className={`marker w-7 ${r.rank <= 3 ? "text-accent" : "text-muted"}`}>{String(r.rank).padStart(2, "0")}</span>
                <Link href={`/atleta/${r.user_id}`} className="self-start pt-0.5">
                  <Avatar name={r.profiles?.full_name} url={r.profiles?.avatar_url} size={36} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/atleta/${r.user_id}`} className="block truncate font-semibold">
                    {r.profiles?.full_name || t("Sin nombre")}
                    {me && <span className="ml-1 text-xs text-accent">{t("(tú)")}</span>}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="rounded bg-line px-1.5 py-0.5 font-semibold uppercase">{r.division}</span>
                    {r.profiles?.gender && <span>{r.profiles.gender === "M" ? "♂" : "♀"}</span>}
                    {!inTime(wod.wod_date, byId.get(r.id)?.created_at) && (
                      <span className="shrink-0 rounded border border-line px-1 py-0.5" title={t("Metido después del cierre: no cuenta para medallas")}>
                        {t("fuera de plazo")}
                      </span>
                    )}
                    {isCoach && byId.get(r.id)?.flag && !byId.get(r.id)?.flag_reviewed && (
                      <Link href="/coach" className="shrink-0 rounded border border-alert/60 px-1 py-0.5 text-alert" title={byId.get(r.id)?.flag ?? ""}>
                        ⚠️ {t("revisar")}
                      </Link>
                    )}
                    {other(r.id) && <span className="shrink-0 font-semibold text-fg/80">{other(r.id)}</span>}
                    {r.notes && <span className="truncate">{r.notes}</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Reactions key={JSON.stringify(reactions[r.id] ?? {})} resultId={r.id} initial={reactions[r.id] ?? {}} own={me} />
                    <Link
                      href={`/r/${r.id}`}
                      className={`flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border px-3 text-base ${comments[r.id] ? "border-accent/60 text-fg" : "border-line text-muted"}`}
                      aria-label={t("Comentarios")}
                    >
                      💬{comments[r.id] ? <span className="tabular-nums">{comments[r.id]}</span> : null}
                    </Link>
                  </div>
                </div>
                <span className="h-display text-xl tabular-nums">{r.display}</span>
                {(me || isCoach) && (
                  <form action={deleteResult}>
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmDelete />
                  </form>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {scaled.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            {t("Escalado")} <span className="font-normal normal-case">· {t("sin ranking, cada uno a su manera")}</span>
          </h3>
          <ul className="card divide-y divide-line overflow-hidden">
            {scaled.map((r) => {
              const me = r.user_id === userId;
              return (
                <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${me ? "bg-accent/10" : ""}`}>
                  <Link href={`/atleta/${r.user_id}`} className="self-start pt-0.5">
                    <Avatar name={r.profiles?.full_name} url={r.profiles?.avatar_url} size={36} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/atleta/${r.user_id}`} className="block truncate font-semibold">
                      {r.profiles?.full_name || t("Sin nombre")}
                      {me && <span className="ml-1 text-xs text-accent">{t("(tú)")}</span>}
                    </Link>
                    {r.notes && <div className="whitespace-pre-wrap text-sm text-muted">{r.notes}</div>}
                    <div className="mt-1 flex items-center gap-1">
                      <Reactions key={JSON.stringify(reactions[r.id] ?? {})} resultId={r.id} initial={reactions[r.id] ?? {}} own={me} />
                      <Link
                        href={`/r/${r.id}`}
                        className={`flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border px-3 text-base ${comments[r.id] ? "border-accent/60 text-fg" : "border-line text-muted"}`}
                        aria-label={t("Comentarios")}
                      >
                        💬{comments[r.id] ? <span className="tabular-nums">{comments[r.id]}</span> : null}
                      </Link>
                    </div>
                  </div>
                  <span className="text-emerald-400">✓</span>
                  {(me || isCoach) && (
                    <form action={deleteResult}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmDelete />
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
