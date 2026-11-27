import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isCoachProfile, memberSince, planHorizon, requireUser } from "@/lib/supabase/server";
import { addDays, dayHref, fullDayHref, isISODate, todayISO } from "@/lib/dates";
import { mondayOf } from "@/lib/week-parser";
import { myStreak } from "@/lib/streak-data";
import { StreakCard } from "@/components/streak-card";
import { WEEK_GOAL } from "@/lib/streaks";
import { formatScore, formatTime } from "@/lib/scoring";
import { SCORE_TYPES, type Result, type Wod } from "@/lib/types";
import { DayNav, SwipeDays } from "@/components/day-nav";
import { toggleDone } from "@/app/actions";
import { getI18n } from "@/lib/i18n/server";
import { localizeWods } from "@/lib/wod-i18n";
import { DeleteDays } from "@/components/delete-days";

/** Día completo: todas las partes del día en orden, con su enunciado. Al pulsar una entras a apuntar el resultado. */
export default async function FullDayPage({ params }: PageProps<"/dia/[date]">) {
  const { date } = await params;
  if (!isISODate(date)) notFound();
  const { supabase, user, profile, box } = await requireUser();
  const isCoach = isCoachProfile(profile);
  const since = memberSince(profile);
  if (since && date < since) redirect(fullDayHref(since));
  const horizon = planHorizon(profile, todayISO());
  if (horizon && date > horizon) redirect(fullDayHref(horizon));
  const { t, lang } = await getI18n();
  const today = todayISO();
  const monday = mondayOf(date);

  const [streak, { data: weekWods }, { data: wodsData }] = await Promise.all([
    myStreak(supabase, user.id),
    supabase.from("wods").select("wod_date").eq("published", true).gte("wod_date", monday).lte("wod_date", addDays(monday, 6)),
    supabase.from("wods").select("*").eq("wod_date", date).order("part").order("created_at").returns<Wod[]>(),
  ]);
  const wods = localizeWods(wodsData ?? [], lang);
  const { data: mine } = wods.length
    ? await supabase.from("results").select("*").eq("user_id", user.id).in("wod_id", wods.map((w) => w.id)).returns<Result[]>()
    : { data: [] as Result[] };
  const myResult = new Map((mine ?? []).map((r) => [r.wod_id, r]));

  const planDays = new Set((weekWods ?? []).map((w) => w.wod_date as string));
  const week = t("L,M,X,J,V,S,D").split(",").map((label, i) => {
    const d = addDays(monday, i);
    const status = streak.done.has(d) ? "done" : !planDays.has(d) ? "rest" : d < today ? "missed" : "pending";
    return { date: d, label, status: status as "done" | "missed" | "pending" | "rest", isToday: d === today, selected: d === date };
  });
  // Coach: cuántas partes hay en toda la semana (con borradores) para poder borrarla entera
  const { count: weekCount } = isCoach
    ? await supabase.from("wods").select("id", { count: "exact", head: true }).gte("wod_date", monday).lte("wod_date", addDays(monday, 6))
    : { count: 0 };
  const done = wods.filter((w) => myResult.has(w.id)).length;
  const canLog = date <= today;

  return (
    <SwipeDays date={date} min={since} max={horizon} base="dia">
      <div className="space-y-5">
        <DayNav date={date} today={today} min={since} max={horizon} base="dia" />

        {!box.competition && <StreakCard
          days={streak.stats.days}
          bestDays={streak.stats.bestDays}
          current={streak.stats.current}
          best={streak.stats.best}
          week={week}
          goal={Math.min(WEEK_GOAL, Math.max(1, planDays.size))}
        />}

        {wods.length === 0 ? (
          <div className="card space-y-2 p-8 text-center">
            <p className="h-title text-3xl text-muted">{t("Día sin WOD")}</p>
            <p className="text-sm text-muted">{t("Desliza o usa las flechas para cambiar de día.")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between px-1">
              <h1 className="h-title text-3xl">{t("Día completo")}</h1>
              <span className="text-sm text-muted">{t("{done} de {total} hechas", { done, total: wods.length })}</span>
            </div>
            <ol className="space-y-3">
              {wods.map((w) => {
                const r = myResult.get(w.id);
                const isCheck = w.score_type === "check";
                return (
                  <li key={w.id} className={`card overflow-hidden ${r ? "border-emerald-500/40" : ""}`}>
                    <Link href={dayHref(date, { w: w.id })} className="block p-4">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs uppercase tracking-wider text-muted">
                        <span className="rounded bg-accent px-1.5 font-display text-sm font-bold text-accent-fg">{w.part}</span>
                        <span className="text-accent">{t(SCORE_TYPES[w.score_type].label)}</span>
                        {w.time_cap_seconds ? <span>· Cap {formatTime(w.time_cap_seconds)}</span> : null}
                        {!w.published && <span className="text-yellow-400">· {t("Borrador")}</span>}
                      </div>
                      <h2 className="h-title mt-1 text-2xl">{w.title}</h2>
                      {w.description && <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{w.description}</p>}
                    </Link>
                    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
                      {r ? (
                        <span className="text-sm font-semibold text-emerald-400">✓ {isCheck ? t("Hecho") : formatScore(w, r)}</span>
                      ) : (
                        <span className="text-sm text-muted">{t("Sin hacer")}</span>
                      )}
                      {isCheck && canLog ? (
                        <form action={toggleDone}>
                          <input type="hidden" name="wod_id" value={w.id} />
                          <input type="hidden" name="back" value={fullDayHref(date)} />
                          <button className={r ? "btn-ghost px-3 py-1.5 text-sm" : "btn px-3 py-1.5 text-sm"}>
                            {r ? t("Desmarcar") : t("Marcar hecho")}
                          </button>
                        </form>
                      ) : (
                        <Link href={dayHref(date, { w: w.id })} className="text-sm font-semibold text-accent">
                          {r ? t("Ver ranking ›") : canLog ? t("Apuntar resultado ›") : t("Ver ›")}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {isCoach && (
          <DeleteDays date={date} monday={monday} sunday={addDays(monday, 6)} dayCount={wods.length} weekCount={weekCount ?? 0} />
        )}
      </div>
    </SwipeDays>
  );
}
