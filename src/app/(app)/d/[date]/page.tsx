import Link from "next/link";
import { AiTip } from "@/components/ai-tip";
import { WodTimer } from "@/components/wod-timer";
import { WarmupButton } from "@/components/warmup-button";
import { WodComments, type WodComment } from "@/components/wod-comments";
import type { CommentReaction } from "@/lib/comment-reactions";
import { staffIds } from "@/lib/push";
import { moveWod } from "@/app/actions";
import { tipFor } from "@/lib/ai-tips";
import { notFound, redirect } from "next/navigation";
import { isCoachProfile, memberSince, requireUser } from "@/lib/supabase/server";
import { addDays, dayHref, isISODate, todayISO } from "@/lib/dates";
import { mondayOf } from "@/lib/week-parser";
import { myStreak } from "@/lib/streak-data";
import { StreakCard } from "@/components/streak-card";
import { formatTime } from "@/lib/scoring";
import { SCORE_TYPES, type Division, type Gender, type Result, type Wod } from "@/lib/types";
import { DayNav, SwipeDays } from "@/components/day-nav";
import { ResultForm } from "@/components/result-form";
import { Leaderboard } from "@/components/leaderboard";
import type { ReactionSummary } from "@/components/reactions";
import { getI18n } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/core";

export default async function DayPage({ params, searchParams }: PageProps<"/d/[date]">) {
  const { date } = await params;
  if (!isISODate(date)) notFound();
  const sp = await searchParams;
  const gender = (["M", "F"].includes(String(sp.g)) ? sp.g : "all") as Gender | "all";
  const division = (["elite", "rx"].includes(String(sp.d)) ? sp.d : "all") as Division | "all";
  const score = (sp.s === "2" ? 2 : 1) as 1 | 2;

  const { supabase, user, profile, box } = await requireUser();
  const isCoach = isCoachProfile(profile);
  // Atletas nuevos: no ven ni participan en la plani anterior a su alta
  const since = memberSince(profile);
  if (since && date < since) redirect(dayHref(since));
  const { t, locale } = await getI18n();
  const today = todayISO();

  const streakP = myStreak(supabase, user.id);
  const monday = mondayOf(date);
  const weekDaysP = supabase
    .from("wods")
    .select("wod_date")
    .eq("published", true)
    .gte("wod_date", monday)
    .lte("wod_date", addDays(monday, 6));
  const { data: wodsData } = await supabase
    .from("wods")
    .select("*")
    .eq("wod_date", date)
    .order("part")
    .order("created_at")
    .returns<Wod[]>();
  const wods = wodsData ?? [];
  const selected = wods.find((w) => w.id === sp.w) ?? wods[0] ?? null;
  // Dudas del WOD: comentarios, sus reacciones y quién es del equipo (sus respuestas salen destacadas)
  const [{ data: wodComments }, staffList] = selected
    ? await Promise.all([
        supabase
          .from("wod_comments")
          .select("id, user_id, body, pinned, created_at, profiles!wod_comments_user_id_fkey(full_name, avatar_url)")
          .eq("wod_id", selected.id)
          .order("created_at")
          .returns<WodComment[]>(),
        staffIds(box.id),
      ])
    : [{ data: [] as WodComment[] }, [] as string[]];
  const wcReactions = new Map<string, CommentReaction[]>();
  if (wodComments?.length) {
    const { data: rx } = await supabase
      .from("wod_comment_reactions")
      .select("comment_id, user_id, emoji, profiles!wod_comment_reactions_user_id_fkey(full_name)")
      .in("comment_id", wodComments.map((c) => c.id))
      .returns<{ comment_id: string; user_id: string; emoji: string; profiles: { full_name: string } | null }[]>();
    for (const x of rx ?? []) wcReactions.set(x.comment_id, [...(wcReactions.get(x.comment_id) ?? []), { user_id: x.user_id, emoji: x.emoji, name: x.profiles?.full_name ?? "" }]);
  }
  // Consejo de IA ya pedido para este WOD (si lo hay, sale abierto)
  const { data: tip } = selected
    ? await supabase.from("ai_tips").select("body").eq("wod_id", selected.id).eq("user_id", user.id).maybeSingle<{ body: string }>()
    : { data: null };

  let results: Result[] = [];
  let doneIds = new Set<string>();
  const reactions: Record<string, ReactionSummary> = {};
  const commentCounts: Record<string, number> = {};
  if (selected) {
    // Resultados (con nombre y reacciones embebidos) y mis WODs hechos, en paralelo
    type Row = Result & { reactions?: { user_id: string; emoji: string }[]; result_comments?: { count: number }[] };
    const [{ data: full, error: fullErr }, { data: mine }] = await Promise.all([
      supabase
        .from("results")
        .select("*, profiles!results_user_id_fkey(full_name, gender, avatar_url), reactions(user_id, emoji), result_comments(count)")
        .eq("wod_id", selected.id)
        .returns<Row[]>(),
      supabase.from("results").select("wod_id").eq("user_id", user.id).in("wod_id", wods.map((w) => w.id)),
    ]);
    let r: Row[] | null = full;
    if (fullErr) {
      // Si falla lo embebido (reacciones/comentarios), que al menos salga el leaderboard
      console.error("[leaderboard] resultados con reacciones/comentarios:", fullErr.message);
      const { data: plain, error: plainErr } = await supabase
        .from("results")
        .select("*, profiles!results_user_id_fkey(full_name, gender, avatar_url)")
        .eq("wod_id", selected.id)
        .returns<Row[]>();
      if (plainErr) console.error("[leaderboard] resultados:", plainErr.message);
      r = plain;
    }
    results = r ?? [];
    doneIds = new Set((mine ?? []).map((x) => x.wod_id));
    for (const res of r ?? []) {
      commentCounts[res.id] = res.result_comments?.[0]?.count ?? 0;
      for (const x of res.reactions ?? []) {
        const m = (reactions[res.id] ??= {});
        const e = (m[x.emoji] ??= { count: 0, mine: false });
        e.count++;
        if (x.user_id === user.id) e.mine = true;
      }
    }
  }
  const mine = results.find((r) => r.user_id === user.id) ?? null;

  // Racha y semana (L–D) del día que estás viendo
  const [streak, { data: weekWods }] = await Promise.all([streakP, weekDaysP]);
  const planDays = new Set((weekWods ?? []).map((w) => w.wod_date as string));
  const week = t("L,M,X,J,V,S,D").split(",").map((label, i) => {
    const d = addDays(monday, i);
    const training = planDays.has(d);
    const status = streak.done.has(d) ? "done" : !training ? "rest" : d < today ? "missed" : "pending";
    return { date: d, label, status: status as "done" | "missed" | "pending" | "rest", isToday: d === today, selected: d === date };
  });
  const pendingToday = date <= today && wods.some((w) => w.published) && !streak.done.has(date);
  // Primera letra libre del día (A, B, C…)
  const usedParts = new Set(wods.map((w) => w.part));
  const nextPart = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((l) => !usedParts.has(l)) ?? "Z";

  return (
    <SwipeDays date={date} min={since}>
      <div className="space-y-5">
        <DayNav date={date} today={today} min={since} />

        <StreakCard
          current={streak.stats.current}
          best={streak.stats.best}
          week={week}
          hint={pendingToday ? t("Mete tu resultado y el día cuenta para la racha.") : undefined}
        />

        {wods.length === 0 ? (
          <div className="card space-y-2 p-8 text-center">
            <p className="h-title text-3xl text-muted">{t("Día sin WOD")}</p>
            <p className="text-sm text-muted">{t("Desliza o usa las flechas para cambiar de día.")}</p>
          </div>
        ) : (
          <>
            {wods.length > 1 && (
              <nav className="flex gap-2 overflow-x-auto pb-1" data-noswipe>
                {wods.map((w) => {
                  const on = w.id === selected!.id;
                  return (
                    <Link
                      key={w.id}
                      href={dayHref(date, { w: w.id })}
                      replace
                      scroll={false}
                      className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 transition ${
                        on ? "border-accent bg-accent text-accent-fg" : "border-line text-muted hover:text-fg"
                      }`}
                    >
                      <span className="h-display text-2xl">{w.part}</span>
                      <span className="max-w-32 truncate text-sm font-semibold">{w.title}</span>
                      {doneIds.has(w.id) && <span className={on ? "" : "text-emerald-400"}>✓</span>}
                    </Link>
                  );
                })}
              </nav>
            )}

            {isCoach && wods.length > 1 && (
              <div className="flex items-center justify-end gap-2 text-xs text-muted" data-noswipe>
                <span>{t("Orden de la parte {part}:", { part: selected!.part })}</span>
                {(["up", "down"] as const).map((dir) => {
                  const i = wods.findIndex((w) => w.id === selected!.id);
                  const disabled = dir === "up" ? i === 0 : i === wods.length - 1;
                  return (
                    <form key={dir} action={moveWod}>
                      <input type="hidden" name="id" value={selected!.id} />
                      <input type="hidden" name="dir" value={dir} />
                      <button disabled={disabled} className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-30" aria-label={dir === "up" ? t("Mover antes") : t("Mover después")}>
                        {dir === "up" ? "◀" : "▶"}
                      </button>
                    </form>
                  );
                })}
              </div>
            )}

            <WodHeader wod={selected!} isCoach={isCoach} t={t} />

            <WarmupButton key={`warm-${selected!.id}`} wodId={selected!.id} />

            <WodTimer key={`timer-${selected!.id}`} wod={selected!} />

            <AiTip key={`tip-${selected!.id}`} wodId={selected!.id} initial={tip ? tipFor(tip.body, locale) : null} />

            <WodComments
              wodId={selected!.id}
              comments={wodComments ?? []}
              reactions={wcReactions}
              staff={new Set(staffList)}
              me={user.id}
              myName={profile?.full_name ?? ""}
              isCoach={isCoach}
              t={t}
              locale={locale}
            />

            <ResultForm key={selected!.id} wod={selected!} existing={mine} defaultDivision={profile?.division ?? undefined} />

            <Leaderboard
              wod={selected!}
              results={results}
              userId={user.id}
              isCoach={isCoach}
              reactions={reactions}
              comments={commentCounts}
              gender={gender}
              division={division}
              score={selected!.score2_type ? score : 1}
              href={(g, d, s) =>
                dayHref(date, {
                  w: wods.length > 1 ? selected!.id : undefined,
                  g: g !== "all" ? g : undefined,
                  d: d !== "all" ? d : undefined,
                  s: s === 2 ? "2" : undefined,
                }) + "#leaderboard"
              }
            />
          </>
        )}

        {isCoach && (
          <Link
            href={`/coach?date=${date}&part=${nextPart}`}
            className="block rounded-xl border border-dashed border-accent/60 p-4 text-center font-semibold text-accent"
          >
            {wods.length ? t("+ Añadir parte {p} a este día", { p: nextPart }) : t("+ Añadir WOD a este día")}
          </Link>
        )}
      </div>
    </SwipeDays>
  );
}

function WodHeader({ wod, isCoach, t }: { wod: Wod; isCoach: boolean; t: T }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 text-xs uppercase tracking-wider text-muted">
        <span className="rounded bg-accent px-1.5 font-display text-sm font-bold text-accent-fg">{wod.part}</span>
        <span className="text-accent">
          {t(SCORE_TYPES[wod.score_type].label)}
          {wod.score2_type ? ` + ${t(SCORE_TYPES[wod.score2_type].label)}` : ""}
        </span>
        {wod.time_cap_seconds ? <span>· Cap {formatTime(wod.time_cap_seconds)}</span> : null}
        {wod.is_benchmark && <span>· ★ Benchmark</span>}
        {!wod.published && <span className="text-yellow-400">· {t("Borrador")}</span>}
      </div>
      <div className="flex items-start justify-between gap-3">
        <h1 className="h-title mt-2 text-[2.6rem]">{wod.title}</h1>
        {isCoach && (
          <Link href={`/coach/${wod.id}`} className="btn-ghost mt-1 shrink-0">
            {t("Editar")}
          </Link>
        )}
      </div>
      {wod.description && (
        <pre className="card mt-3 whitespace-pre-wrap p-4 font-sans text-[15px] leading-relaxed">{wod.description}</pre>
      )}
    </div>
  );
}
