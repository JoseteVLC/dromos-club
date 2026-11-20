import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";
import { weekOf } from "./streaks";

/** Días sin meter resultado a partir de los que alguien está «en riesgo» (y hasta cuándo seguimos avisando). */
export const RISK_DAYS = 10;
export const RISK_MAX_DAYS = 60;

export type RiskPerson = { id: string; name: string; avatar_url: string | null; lastDone: string | null; days: number; never: boolean };
export type BoxStats = {
  members: number; // atletas activos dados de alta
  activeThisWeek: number;
  activeLastWeek: number;
  resultsThisWeek: number;
  newMembers30: number;
  weekly: { week: string; active: number }[]; // últimas 8 semanas
  byWeekday: { label: number; avg: number }[]; // 0 = lunes; media de atletas por día (últimas 4 semanas)
  topWods: { id: string; title: string; part: string; date: string; n: number }[];
  atRisk: RiskPerson[];
  /** Todos los atletas: % de la plani hecha esta semana y en las últimas 4 (desde su alta) */
  athletes: AthleteRow[];
};

export type AthleteRow = { id: string; name: string; avatar_url: string | null; lastDone: string | null; week: { done: number; planned: number }; month: { done: number; planned: number } };

type Member = { id: string; name: string; avatar_url: string | null; joined: string };
type Row = { user_id: string; wod_id: string; wods: { id: string; title: string; part: string; wod_date: string } };

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

/** Atletas activos (sin coaches ni admins), con su fecha de alta. */
async function members(db: SupabaseClient, boxId: string): Promise<Member[]> {
  type M = { user_id: string; joined_at: string; profiles: { full_name: string; avatar_url: string | null; active: boolean } };
  const out: Member[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("box_members")
      .select("user_id, joined_at, profiles!inner(full_name, avatar_url, active)")
      .eq("box_id", boxId)
      .eq("active", true)
      .eq("pending", false)
      .eq("role", "athlete")
      .order("user_id")
      .range(from, from + 999)
      .returns<M[]>();
    out.push(...(data ?? []).filter((m) => m.profiles.active).map((m) => ({ id: m.user_id, name: m.profiles.full_name || "Sin nombre", avatar_url: m.profiles.avatar_url, joined: m.joined_at })));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Resultados con su WOD desde una fecha (paginado). */
async function resultsSince(db: SupabaseClient, since: string, boxId: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("results")
      .select("user_id, wod_id, wods!inner(id, title, part, wod_date)")
      .eq("box_id", boxId)
      .gte("wods.wod_date", since)
      .order("id")
      .range(from, from + 999)
      .returns<Row[]>();
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Números del box para el panel de coaches y dueños, y la lista de quién está en riesgo de dejarlo. */
export async function boxStats(db: SupabaseClient, today: string, boxId: string): Promise<BoxStats> {
  const since = addDays(weekOf(today), -7 * 7); // 8 semanas con la actual
  const from28 = addDays(today, -27);
  const [people, rows, { data: plan }] = await Promise.all([
    members(db, boxId),
    resultsSince(db, addDays(today, -RISK_MAX_DAYS - 7), boxId),
    db.from("wods").select("id, wod_date").eq("box_id", boxId).eq("published", true).gte("wod_date", [from28, weekOf(today)].sort()[0]).lte("wod_date", today).limit(2000),
  ]);
  const ids = new Set(people.map((p) => p.id));
  const mine = rows.filter((r) => ids.has(r.user_id));

  // Días entrenados por persona
  const daysBy = new Map<string, Set<string>>();
  for (const r of mine) {
    if (!daysBy.has(r.user_id)) daysBy.set(r.user_id, new Set());
    daysBy.get(r.user_id)!.add(r.wods.wod_date);
  }

  // Activos por semana
  const thisWeek = weekOf(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(since, i * 7));
  const activeIn = (w: string) => {
    let n = 0;
    for (const set of daysBy.values()) if ([...set].some((d) => weekOf(d) === w)) n++;
    return n;
  };
  const weekly = weeks.map((w) => ({ week: w, active: activeIn(w) }));

  // Asistencia media por día de la semana (4 semanas completas anteriores)
  const from4 = addDays(thisWeek, -28);
  const perDay = new Map<string, Set<string>>();
  for (const r of mine) {
    const d = r.wods.wod_date;
    if (d < from4 || d >= thisWeek) continue;
    if (!perDay.has(d)) perDay.set(d, new Set());
    perDay.get(d)!.add(r.user_id);
  }
  const sum = Array(7).fill(0);
  const cnt = Array(7).fill(0);
  for (const [d, set] of perDay) {
    const wd = (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7;
    sum[wd] += set.size;
    cnt[wd]++;
  }
  const byWeekday = sum.map((s, i) => ({ label: i, avg: cnt[i] ? Math.round((s / cnt[i]) * 10) / 10 : 0 }));

  // WODs más hechos (30 días)
  const wodN = new Map<string, { id: string; title: string; part: string; date: string; n: number }>();
  for (const r of mine) {
    if (r.wods.wod_date < addDays(today, -30)) continue;
    const e = wodN.get(r.wods.id) ?? { id: r.wods.id, title: r.wods.title, part: r.wods.part, date: r.wods.wod_date, n: 0 };
    e.n++;
    wodN.set(r.wods.id, e);
  }
  const topWods = [...wodN.values()].sort((a, b) => b.n - a.n || b.date.localeCompare(a.date)).slice(0, 5);

  // En riesgo: lleva RISK_DAYS+ días sin meter nada (o nunca ha metido nada y lleva una semana de alta)
  const atRisk: RiskPerson[] = [];
  for (const p of people) {
    const set = daysBy.get(p.id);
    const last = set ? [...set].sort().at(-1)! : null;
    if (last) {
      const days = daysBetween(last, today);
      if (days >= RISK_DAYS && days <= RISK_MAX_DAYS) atRisk.push({ id: p.id, name: p.name, avatar_url: p.avatar_url, lastDone: last, days, never: false });
    } else {
      const days = daysBetween(p.joined.slice(0, 10), today);
      if (days >= 7 && days <= RISK_MAX_DAYS) atRisk.push({ id: p.id, name: p.name, avatar_url: p.avatar_url, lastDone: null, days, never: true });
    }
  }
  // Sin nada reciente: solo es «nuevo sin estrenar» si de verdad nunca ha metido nada (si no, ya pasó el plazo de aviso)
  const nev = atRisk.filter((r) => r.never).map((r) => r.id);
  if (nev.length) {
    const { data: old } = await db.from("results").select("user_id").eq("box_id", boxId).in("user_id", nev).limit(5000);
    const trained = new Set((old ?? []).map((r) => r.user_id as string));
    for (let i = atRisk.length - 1; i >= 0; i--) if (atRisk[i].never && trained.has(atRisk[i].id)) atRisk.splice(i, 1);
  }
  atRisk.sort((a, b) => Number(a.never) - Number(b.never) || b.days - a.days);

  // Cada atleta: partes hechas / partes de la plani (esta semana y últimas 4), contando solo desde su alta
  const wk = weekOf(today);
  const doneBy = new Map<string, Set<string>>();
  for (const r of mine) {
    if (!doneBy.has(r.user_id)) doneBy.set(r.user_id, new Set());
    doneBy.get(r.user_id)!.add(r.wod_id);
  }
  const athletes: AthleteRow[] = people
    .map((p) => {
      const joined = p.joined.slice(0, 10);
      const dn = doneBy.get(p.id) ?? new Set<string>();
      const count = (from: string) => {
        const list = (plan ?? []).filter((w) => w.wod_date >= from && w.wod_date >= joined);
        return { planned: list.length, done: list.filter((w) => dn.has(w.id as string)).length };
      };
      const set = daysBy.get(p.id);
      return { id: p.id, name: p.name, avatar_url: p.avatar_url, lastDone: set ? [...set].sort().at(-1)! : null, week: count(wk), month: count(from28) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    athletes,
    members: people.length,
    activeThisWeek: activeIn(thisWeek),
    activeLastWeek: activeIn(addDays(thisWeek, -7)),
    resultsThisWeek: mine.filter((r) => r.wods.wod_date >= thisWeek).length,
    newMembers30: people.filter((p) => p.joined.slice(0, 10) >= addDays(today, -30)).length,
    weekly,
    byWeekday,
    topWods,
    atRisk,
  };
}
