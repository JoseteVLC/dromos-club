import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { requireCoach } from "@/lib/supabase/server";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";
import { boxStats, RISK_DAYS } from "@/lib/box-stats";
import { todayISO, dayHref } from "@/lib/dates";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icon";

/** Panel del box para coaches y dueños: actividad, asistencia y quién está dejando de venir. */
export default async function PanelPage() {
  const { box } = await requireCoach();
  const { t, locale } = await getI18n();
  if (!hasAdminKey()) return <p className="card p-4 text-sm">{t("Falta la variable SUPABASE_SECRET_KEY en Vercel.")}</p>;
  const today = todayISO();
  const s = await boxStats(adminDb(), today, box.id);

  const diff = s.activeThisWeek - s.activeLastWeek;
  const maxWeek = Math.max(1, ...s.weekly.map((w) => w.active));
  const maxDay = Math.max(1, ...s.byWeekday.map((d) => d.avg));
  const dayLabels = t("L,M,X,J,V,S,D").split(",");
  const fmtWeek = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const pct = s.members ? Math.round((s.activeThisWeek / s.members) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href="/coach" className="text-sm text-muted">← {t("Coach")}</Link>
        <h1 className="h-title text-5xl">{t("Panel del box")}</h1>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Kpi value={s.activeThisWeek} label={t("activos esta semana")} sub={diff === 0 ? t("igual que la semana pasada") : diff > 0 ? t("+{n} vs semana pasada", { n: diff }) : t("{n} vs semana pasada", { n: diff })} tone={diff < 0 ? "down" : diff > 0 ? "up" : undefined} />
        <Kpi value={`${pct}%`} label={t("del total de atletas")} sub={t("{n} atletas dados de alta", { n: s.members })} />
        <Kpi value={s.resultsThisWeek} label={t("resultados esta semana")} />
        <Kpi value={s.newMembers30} label={t("altas en 30 días")} />
      </section>

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="users" size={20} tile /> {t("Atletas activos por semana")}</h2>
        <div className="card p-4">
          <div className="flex h-36 items-end gap-2">
            {s.weekly.map((w, i) => (
              <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold tabular-nums">{w.active}</span>
                <div className={`w-full rounded-t ${i === s.weekly.length - 1 ? "bg-accent" : "bg-accent/40"}`} style={{ height: `${Math.max(4, (w.active / maxWeek) * 100)}px` }} />
                <span className="text-[10px] text-muted">{fmtWeek(w.week)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{t("Atletas que han metido al menos un resultado esa semana. La última barra es la semana en curso.")}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="calendar" size={20} tile /> {t("Asistencia por día")}</h2>
        <div className="card p-4">
          <div className="flex h-28 items-end gap-2">
            {s.byWeekday.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold tabular-nums">{d.avg ? d.avg.toLocaleString(locale) : "–"}</span>
                <div className="w-full rounded-t bg-accent/70" style={{ height: `${Math.max(d.avg ? 4 : 0, (d.avg / maxDay) * 80)}px` }} />
                <span className="text-[11px] font-semibold text-muted">{dayLabels[d.label]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{t("Media de atletas que meten resultado cada día, en las últimas 4 semanas.")}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="alert" size={20} tile /> {t("En riesgo de dejarlo")} · {s.atRisk.length}</h2>
        <p className="text-sm text-muted">
          {t("Llevan {n} días o más sin meter ningún resultado, o se dieron de alta hace una semana y aún no han empezado. A ellos les llega un recordatorio automático; un mensaje vuestro suele funcionar mejor.", { n: RISK_DAYS })}
        </p>
        {s.atRisk.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t("Nadie en riesgo ahora mismo. 💪")}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {s.atRisk.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={p.name} url={p.avatar_url} size={34} />
                <div className="min-w-0 flex-1">
                  <Link href={`/coach/atleta/${p.id}`} className="block truncate font-semibold">{p.name === "Sin nombre" ? t("Sin nombre") : p.name}</Link>
                  <div className="text-xs text-muted">
                    {p.never ? t("Alta hace {n} días, aún sin resultados", { n: p.days }) : t("{n} días sin entrenar · último: {d}", { n: p.days, d: fmtWeek(p.lastDone!) })}
                  </div>
                </div>
                <Link href={`/mensajes/${p.id}`} className="chip inline-flex shrink-0 items-center gap-1.5"><Icon name="mail" size={14} /> {t("Escribir")}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="clipboard" size={20} tile /> {t("Atletas")} · {s.athletes.length}</h2>
        <p className="text-sm text-muted">{t("Qué parte de la plani ha hecho cada uno, esta semana y en las últimas 4. Toca un atleta para ver su ficha completa.")}</p>
        {s.athletes.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t("Aún no hay atletas en el box.")}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {s.athletes.map((p) => {
              const pc = (x: { done: number; planned: number }) => (x.planned ? Math.round((x.done / x.planned) * 100) : null);
              const m = pc(p.month);
              const w = pc(p.week);
              return (
                <li key={p.id}>
                  <Link href={`/coach/atleta/${p.id}`} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={p.name} url={p.avatar_url} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.name === "Sin nombre" ? t("Sin nombre") : p.name}</div>
                      <div className="text-xs text-muted">{p.lastDone ? t("Último entreno: {d}", { d: fmtWeek(p.lastDone) }) : t("Aún sin resultados")}</div>
                    </div>
                    <div className="text-right">
                      <div className={`h-display text-xl tabular-nums ${m != null && m < 50 ? "text-alert" : ""}`}>{m == null ? "–" : `${m}%`}</div>
                      <div className="text-[10px] uppercase text-muted">{t("4 sem.")} · {t("esta: {p}", { p: w == null ? "–" : `${w}%` })}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="h-display flex items-center gap-3 text-2xl"><Icon name="trophy" size={20} tile /> {t("WODs más hechos")}</h2>
        {s.topWods.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t("Aún no hay resultados en los últimos 30 días.")}</p>
        ) : (
          <ol className="card divide-y divide-line">
            {s.topWods.map((w, i) => (
              <li key={w.id}>
                <Link href={dayHref(w.date, { w: w.id })} className="flex items-center gap-3 px-4 py-3">
                  <span className="marker w-6 text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{w.part} · {w.title}</div>
                    <div className="text-xs text-muted">{fmtWeek(w.date)}</div>
                  </div>
                  <span className="h-display text-xl tabular-nums">{w.n}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-muted">{t("Por número de resultados, en los últimos 30 días.")}</p>
      </section>
    </div>
  );
}

function Kpi({ value, label, sub, tone }: { value: number | string; label: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="card space-y-1 p-4">
      <div className="h-display text-4xl tabular-nums">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      {sub && <div className={`text-xs ${tone === "down" ? "text-alert" : tone === "up" ? "text-accent" : "text-muted"}`}>{sub}</div>}
    </div>
  );
}
