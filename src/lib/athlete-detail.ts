import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";
import { computeStreak, weekOf, type StreakStats } from "./streaks";
import { formatScore } from "./scoring";
import type { Result, Wod } from "./types";
import type { Benchmark, PersonalRecord } from "./marcas";

/** Estado de un día en el calendario del atleta. */
export type DayStatus = "full" | "partial" | "missed" | "pending" | "rest" | "future" | "before";

export type PartRow = {
  wod: Wod;
  result: Result | null;
  score: string | null; // marca formateada (o «✓» en «Hecho»)
};

export type WeekRow = { week: string; planned: number; done: number; planDays: number; trainedDays: number };

export type AthleteDetail = {
  id: string;
  name: string;
  avatar_url: string | null;
  division: string | null;
  gender: string | null;
  joined: string; // YYYY-MM-DD
  start: string; // inicio del periodo que se enseña (lunes)
  today: string;
  // Periodo
  planned: number; // partes de la plani (hasta hoy, desde el alta)
  done: number;
  planDays: number;
  trainedDays: number;
  fullDays: number;
  checkPlanned: number; // partes de técnica/calentamiento («Hecho»)
  checkDone: number;
  scoredPlanned: number; // partes con marca
  scoredDone: number;
  scaled: number; // resultados en escalado
  byWeekday: { planned: number; done: number }[]; // 0 = lunes
  weeks: WeekRow[];
  calendar: Map<string, DayStatus>;
  days: { date: string; parts: PartRow[] }[]; // del más reciente al más antiguo
  // Siempre (desde el alta)
  streak: StreakStats;
  totalResults: number;
  firstDone: string | null;
  lastDone: string | null;
  // Marcas
  prs: { b: Benchmark; rm: number | null; list: PersonalRecord[] }[];
};

type ResRow = Result & { wods: Wod };

/**
 * Ficha de un atleta para el equipo del box: todo lo que ha hecho y lo que no, semana a semana.
 * Usa la clave de servidor con el box filtrado a mano (solo se llama desde páginas de coach).
 */
export async function athleteDetail(db: SupabaseClient, boxId: string, userId: string, today: string, weeks: number | null): Promise<AthleteDetail | null> {
  const { data: mem } = await db
    .from("box_members")
    .select("joined_at, profiles!inner(full_name, avatar_url, division, gender)")
    .eq("box_id", boxId)
    .eq("user_id", userId)
    .maybeSingle<{ joined_at: string; profiles: { full_name: string; avatar_url: string | null; division: string | null; gender: string | null } }>();
  if (!mem) return null;
  const joined = mem.joined_at.slice(0, 10);
  const joinedMonday = weekOf(joined);
  const start = weeks ? [joinedMonday, addDays(weekOf(today), -7 * (weeks - 1))].sort().at(-1)! : joinedMonday;

  const [{ data: allWods }, { data: res }, { data: prs }, { data: benches }] = await Promise.all([
    db.from("wods").select("*").eq("box_id", boxId).eq("published", true).gte("wod_date", joined).lte("wod_date", today).order("wod_date").order("part").limit(5000).returns<Wod[]>(),
    db.from("results").select("*, wods!inner(*)").eq("box_id", boxId).eq("user_id", userId).limit(5000).returns<ResRow[]>(),
    db.from("personal_records").select("*").eq("user_id", userId).order("performed_on").limit(2000).returns<PersonalRecord[]>(),
    db.from("benchmarks").select("*").returns<Benchmark[]>(),
  ]);
  const wods = allWods ?? [];
  const results = res ?? [];
  const byWod = new Map(results.map((r) => [r.wod_id, r]));

  // Siempre: constancia y totales desde el alta
  const doneDays = new Set(results.map((r) => r.wods.wod_date));
  const streak = computeStreak(wods.map((w) => w.wod_date), doneDays, today);
  const sortedDone = [...doneDays].sort();

  // Periodo
  const inRange = wods.filter((w) => w.wod_date >= start);
  const byDate = new Map<string, Wod[]>();
  for (const w of inRange) byDate.set(w.wod_date, [...(byDate.get(w.wod_date) ?? []), w]);

  let planned = 0, done = 0, checkPlanned = 0, checkDone = 0, scoredPlanned = 0, scoredDone = 0, fullDays = 0, trainedDays = 0;
  const byWeekday = Array.from({ length: 7 }, () => ({ planned: 0, done: 0 }));
  const weekMap = new Map<string, WeekRow>();
  const calendar = new Map<string, DayStatus>();
  const days: AthleteDetail["days"] = [];

  for (let w = start; w <= weekOf(today); w = addDays(w, 7)) weekMap.set(w, { week: w, planned: 0, done: 0, planDays: 0, trainedDays: 0 });
  for (let d = start; d <= addDays(weekOf(today), 6); d = addDays(d, 1)) {
    if (d < joined) calendar.set(d, "before");
    else if (d > today) calendar.set(d, "future");
    else calendar.set(d, "rest");
  }

  for (const [date, list] of byDate) {
    const wk = weekMap.get(weekOf(date))!;
    const wd = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
    let n = 0;
    const parts: PartRow[] = list.map((w) => {
      const r = byWod.get(w.id) ?? null;
      const isCheck = w.score_type === "check";
      planned++;
      wk.planned++;
      byWeekday[wd].planned++;
      if (isCheck) checkPlanned++;
      else scoredPlanned++;
      if (r) {
        n++;
        done++;
        wk.done++;
        byWeekday[wd].done++;
        if (isCheck) checkDone++;
        else scoredDone++;
      }
      return { wod: w, result: r, score: r ? (r.division === "scaled" ? null : formatScore(w, r)) : null };
    });
    wk.planDays++;
    if (n > 0) {
      trainedDays++;
      wk.trainedDays++;
    }
    if (n === list.length) fullDays++;
    calendar.set(date, n === 0 ? (date === today ? "pending" : "missed") : n === list.length ? "full" : "partial");
    days.push({ date, parts });
  }
  days.sort((a, b) => b.date.localeCompare(a.date));

  // Marcas: agrupadas por benchmark (y RM en levantamientos), con su historial
  const benchById = new Map((benches ?? []).map((b) => [b.id, b]));
  const groups = new Map<string, { b: Benchmark; rm: number | null; list: PersonalRecord[] }>();
  for (const pr of prs ?? []) {
    const b = benchById.get(pr.benchmark_id);
    if (!b) continue;
    const rm = b.category === "lifts" || b.category === "olympic" ? (pr.rm ?? 1) : null;
    const key = `${b.id}|${rm ?? ""}`;
    const g = groups.get(key) ?? { b, rm, list: [] };
    g.list.push(pr);
    groups.set(key, g);
  }
  const prGroups = [...groups.values()].sort((x, y) => (y.list.at(-1)!.performed_on).localeCompare(x.list.at(-1)!.performed_on));

  return {
    id: userId,
    name: mem.profiles.full_name || "Sin nombre",
    avatar_url: mem.profiles.avatar_url,
    division: mem.profiles.division,
    gender: mem.profiles.gender,
    joined,
    start,
    today,
    planned,
    done,
    planDays: byDate.size,
    trainedDays,
    fullDays,
    checkPlanned,
    checkDone,
    scoredPlanned,
    scoredDone,
    scaled: results.filter((r) => r.wods.wod_date >= start && r.division === "scaled").length,
    byWeekday,
    weeks: [...weekMap.values()],
    calendar,
    days,
    streak,
    totalResults: results.length,
    firstDone: sortedDone[0] ?? null,
    lastDone: sortedDone.at(-1) ?? null,
    prs: prGroups,
  };
}
