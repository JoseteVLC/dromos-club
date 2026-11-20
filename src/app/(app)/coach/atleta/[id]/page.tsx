import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/supabase/server";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import { athleteDetail, type DayStatus } from "@/lib/athlete-detail";
import { addDays, dayHref, todayISO } from "@/lib/dates";
import { weekOf } from "@/lib/streaks";
import { SCORE_TYPES } from "@/lib/types";
import { formatPR, type PersonalRecord } from "@/lib/marcas";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icon";
import { ProgressChart, type ProgressPoint } from "@/components/progress-chart";

const PERIODS = [
  { key: "4", weeks: 4, label: "4 semanas" },
  { key: "12", weeks: 12, label: "3 meses" },
  { key: "26", weeks: 26, label: "6 meses" },
  { key: "52", weeks: 52, label: "1 año" },
  { key: "todo", weeks: null, label: "Todo" },
] as const;

const DOT: Record<DayStatus, string> = {
  full: "bg-emerald-500 text-white",
  partial: "bg-amber-400 text-black",
  missed: "bg-red-500/80 text-white",
  pending: "border border-accent text-accent",
  rest: "bg-line/50 text-muted",
  future: "text-muted/40",
  before: "text-muted/20",
};

/** Ficha completa de un atleta para el equipo: días que entrena, % de la plani, cada parte hecha o no y sus marcas. */
export default async function AthleteDetailPage({ params, searchParams }: PageProps<"/coach/atleta/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.p) ?? PERIODS[1];
  const { box } = await requireCoach();
  const { t, locale } = await getI18n();
  if (!hasAdminKey()) return <p className="card p-4 text-sm">{t("Falta la variable SUPABASE_SECRET_KEY en Vercel.")}</p>;
  const today = todayISO();
  const a = await athleteDetail(adminDb(), box.id, id, today, period.weeks);
  if (!a) notFound();

  const pct = (d: number, p: number) => (p ? Math.round((d / p) * 100) : 0);
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
    new Date(iso + "T12:00:00Z").toLocaleDateString(locale, { ...o, timeZone: "UTC" });
  const sinceLast = a.lastDone ? Math.round((Date.parse(today) - Date.parse(a.lastDone)) / 864e5) : null;
  const dayLabels = t("L,M,X,J,V,S,D").split(",");
  const maxWeek = Math.max(1, ...a.weeks.map((w) => w.planned));
  const adherence = pct(a.done, a.planned);

  // Calendario: semanas (filas) de lunes a domingo, de la más reciente a la más antigua
  const calWeeks: string[] = [];
  for (let w = weekOf(today); w >= a.start; w = addDays(w, -7)) calWeeks.push(w);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/coach/panel" className="text-sm text-muted">← {t("Panel del box")}</Link>
        <div className="flex items-center gap-4">
          <Avatar name={a.name} url={a.avatar_url} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="h-title truncate text-4xl">{a.name === "Sin nombre" ? t("Sin nombre") : a.name}</h1>
            <div className="flex flex-wrap gap-x-3 text-sm text-muted">
              {a.division && <span className="rounded bg-line px-1.5 py-0.5 text-xs font-semibold uppercase">{a.division}</span>}
              <span>{t("Alta: {d}", { d: fmt(a.joined, { day: "numeric", month: "short", year: "numeric" }) })}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/mensajes/${a.id}`} className="chip"><Icon name="mail" size={14} /> {t("Escribir")}</Link>
          <Link href={`/atleta/${a.id}`} className="chip"><Icon name="user" size={14} /> {t("Ficha pública")}</Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={t("Periodo")}>
        {PERIODS.map((p) => (
          <Link key={p.key} href={`/coach/atleta/${a.id}${p.key === "12" ? "" : `?p=${p.key}`}`} replace scroll={false} className={`chip ${p.key === period.key ? "chip-on" : ""}`}>
            {t(p.label)}
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3">
        <Kpi value={`${adherence}%`} label={t("de la plani hecha")} sub={t("{d} de {p} partes", { d: a.done, p: a.planned })} tone={adherence >= 80 ? "up" : adherence < 50 ? "down" : undefined} />
        <Kpi value={`${a.trainedDays}/${a.planDays}`} label={t("días entrenados")} sub={t("{n} días completos", { n: a.fullDays })} />
        <Kpi value={`${pct(a.scoredDone, a.scoredPlanned)}%`} label={t("partes con marca")} sub={t("{d} de {p}", { d: a.scoredDone, p: a.scoredPlanned })} />
        <Kpi value={a.checkPlanned ? `${pct(a.checkDone, a.checkPlanned)}%` : "–"} label={t("técnica y calentamiento")} sub={t("{d} de {p}", { d: a.checkDone, p: a.checkPlanned })} />
        <Kpi
          value={sinceLast == null ? "–" : sinceLast === 0 ? t("Hoy") : t("{n} d", { n: sinceLast })}
          label={t("desde el último entreno")}
          sub={a.lastDone ? fmt(a.lastDone, { day: "numeric", month: "short", year: "numeric" }) : t("Aún sin resultados")}
          tone={sinceLast != null && sinceLast >= 4 ? "down" : undefined}
        />
        <Kpi value={a.streak.days} label={t("días seguidos")} sub={t("Récord: {n} · {w} semanas de 5 días", { n: a.streak.bestDays, w: a.streak.current })} />
      </section>
      {a.scaled > 0 && <p className="-mt-5 text-xs text-muted">{t("{n} resultados en escalado en este periodo.", { n: a.scaled })}</p>}

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="calendar" size={20} tile /> {t("Calendario")}</h2>
        <div className="card overflow-x-auto p-4" data-noswipe>
          <div className="grid min-w-[300px] grid-cols-[3.5rem_repeat(7,1fr)] gap-1.5 text-center text-[11px]">
            <span />
            {dayLabels.map((l) => <span key={l} className="font-semibold text-muted">{l}</span>)}
            {calWeeks.map((w) => (
              <Week key={w} monday={w} cal={a.calendar} label={fmt(w)} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {([["full", t("Todo hecho")], ["partial", t("Parte")], ["missed", t("Sin hacer")], ["rest", t("Sin plani")]] as const).map(([k, l]) => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className={`inline-block h-3 w-3 rounded ${DOT[k]}`} /> {l}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="chart" size={20} tile /> {t("Semana a semana")}</h2>
        <div className="card overflow-x-auto p-4" data-noswipe>
          <div className="flex h-40 min-w-max items-end gap-1.5">
            {a.weeks.map((w) => (
              <div key={w.week} className="flex w-9 flex-col items-center gap-1" title={t("{d} de {p} partes · {td} de {pd} días", { d: w.done, p: w.planned, td: w.trainedDays, pd: w.planDays })}>
                <span className="text-[10px] font-semibold tabular-nums">{w.planned ? `${pct(w.done, w.planned)}%` : "–"}</span>
                <div className="relative w-full rounded-t bg-line" style={{ height: `${Math.max(4, (w.planned / maxWeek) * 100)}px` }}>
                  <div className={`absolute inset-x-0 bottom-0 rounded-t ${w.week === weekOf(today) ? "bg-accent" : "bg-accent/70"}`} style={{ height: `${w.planned ? (w.done / w.planned) * 100 : 0}%` }} />
                </div>
                <span className="text-[10px] text-muted">{fmt(w.week)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{t("Barra gris: partes de la plani esa semana. Relleno: las que ha hecho. La última es la semana en curso.")}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="activity" size={20} tile /> {t("Por día de la semana")}</h2>
        <div className="card grid grid-cols-7 gap-2 p-4 text-center">
          {a.byWeekday.map((d, i) => (
            <div key={i} className="space-y-1">
              <div className="text-[11px] font-semibold text-muted">{dayLabels[i]}</div>
              <div className={`h-display text-lg tabular-nums ${d.planned && pct(d.done, d.planned) < 50 ? "text-alert" : ""}`}>{d.planned ? `${pct(d.done, d.planned)}%` : "–"}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">{t("Qué parte de la plani hace según el día. Sirve para ver qué días le cuesta más.")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="list" size={20} tile /> {t("Entrenos día a día")}</h2>
        {a.days.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t("No hay plani en este periodo.")}</p>
        ) : (
          <ol className="space-y-3">
            {a.days.map((d) => {
              const n = d.parts.filter((p) => p.result).length;
              return (
                <li key={d.date} className="card overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
                    <span className="font-semibold capitalize">{fmt(d.date, { weekday: "long", day: "numeric", month: "short" })}</span>
                    <span className={`text-xs font-semibold ${n === d.parts.length ? "text-emerald-400" : n === 0 ? "text-alert" : "text-amber-400"}`}>
                      {t("{d} de {p}", { d: n, p: d.parts.length })}
                    </span>
                  </div>
                  <ul className="divide-y divide-line">
                    {d.parts.map(({ wod, result, score }) => (
                      <li key={wod.id}>
                        <Link href={dayHref(wod.wod_date, { w: wod.id })} className="flex items-start gap-3 px-4 py-2.5">
                          <span className="mt-0.5 rounded bg-accent px-1.5 font-display text-sm font-bold text-accent-fg">{wod.part}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{wod.title}</div>
                            <div className="text-xs text-muted">{t(SCORE_TYPES[wod.score_type].label)}</div>
                            {result?.notes && <p className="mt-1 whitespace-pre-wrap text-xs italic text-muted">«{result.notes}»</p>}
                            {result?.flag && <p className="mt-1 text-xs text-alert">⚠️ {result.flag}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            {result ? (
                              <>
                                <div className="font-semibold tabular-nums text-emerald-400">{score ?? "✓"}</div>
                                <div className="text-[10px] uppercase text-muted">{result.division}</div>
                              </>
                            ) : (
                              <span className="text-sm text-alert">{t("No hecho")}</span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="trend" size={20} tile /> {t("Marcas")}</h2>
        {a.prs.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t("Aún no ha apuntado marcas.")}</p>
        ) : (
          <div className="space-y-3">
            {a.prs.map(({ b, rm, list }) => {
              const metric = (r: PersonalRecord): number | null => {
                if (b.score_type === "for_time") return r.finished !== false && r.time_seconds ? r.time_seconds : null;
                if (b.score_type === "amrap") return r.rounds != null ? r.rounds + (r.reps ?? 0) / 100 : null;
                return r.value != null ? Number(r.value) : null;
              };
              const pts: ProgressPoint[] = list
                .filter((r) => r.division === "rx")
                .map((r) => ({ date: r.performed_on, v: metric(r), label: formatPR(b, r) }))
                .filter((p): p is ProgressPoint => p.v != null);
              const last = list.at(-1)!;
              const title = `${b.name}${rm ? ` · ${rm}RM` : ""}`;
              return pts.length >= 2 ? (
                <ProgressChart key={`${b.id}-${rm}`} points={pts} lowerIsBetter={b.score_type === "for_time"} locale={locale} title={title} prLabel="PR" />
              ) : (
                <div key={`${b.id}-${rm}`} className="card flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{title}</div>
                    <div className="text-xs text-muted">{fmt(last.performed_on, { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <div className="h-display text-xl tabular-nums">{formatPR(b, last)}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Week({ monday, cal, label }: { monday: string; cal: Map<string, DayStatus>; label: string }) {
  return (
    <>
      <span className="self-center text-left text-[10px] text-muted">{label}</span>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(monday, i);
        const s = cal.get(d) ?? "before";
        const day = Number(d.slice(8));
        return s === "rest" || s === "future" || s === "before" ? (
          <span key={d} className={`flex h-8 items-center justify-center rounded ${DOT[s]}`}>{day}</span>
        ) : (
          <Link key={d} href={dayHref(d)} className={`flex h-8 items-center justify-center rounded font-semibold ${DOT[s]}`}>{day}</Link>
        );
      })}
    </>
  );
}

function Kpi({ value, label, sub, tone }: { value: number | string; label: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="card space-y-1 p-4">
      <div className="h-display text-3xl tabular-nums">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      {sub && <div className={`text-xs ${tone === "down" ? "text-alert" : tone === "up" ? "text-accent" : "text-muted"}`}>{sub}</div>}
    </div>
  );
}
