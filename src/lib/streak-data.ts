import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStreak, rankStreaks, type StreakStats } from "./streaks";
import { todayISO } from "./dates";

const PAGE = 1000;

/** Supabase devuelve como mucho 1000 filas por petición: pedimos por páginas. */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await q(from, from + PAGE - 1);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

async function trainingDays(supabase: SupabaseClient, today: string, boxId?: string) {
  const rows = await all<{ wod_date: string }>((a, b) =>
    (boxId ? supabase.from("wods").select("wod_date").eq("box_id", boxId) : supabase.from("wods").select("wod_date"))
      .eq("published", true)
      .lte("wod_date", today)
      .order("wod_date")
      .range(a, b),
  );
  return [...new Set(rows.map((r) => r.wod_date))];
}

type DoneRow = { user_id: string; day: string };

async function doneRows(supabase: SupabaseClient, today: string, userId?: string, boxId?: string): Promise<DoneRow[]> {
  const res = await all<{ user_id: string; wods: { wod_date: string } | null }>((a, b) => {
      let q = supabase.from("results").select("user_id, wods!inner(wod_date)").lte("wods.wod_date", today);
      if (userId) q = q.eq("user_id", userId);
      if (boxId) q = q.eq("box_id", boxId);
      return q.order("id").range(a, b).returns<{ user_id: string; wods: { wod_date: string } | null }[]>();
    });
  return res.filter((r) => r.wods).map((r) => ({ user_id: r.user_id, day: r.wods!.wod_date }));
}

/** Días de plani hasta hoy y días que ha entrenado un atleta. */
export async function myTrainingDays(supabase: SupabaseClient, userId: string, boxId?: string) {
  const today = todayISO();
  const [days, rows] = await Promise.all([trainingDays(supabase, today, boxId), doneRows(supabase, today, userId, boxId)]);
  return { days, done: new Set(rows.map((r) => r.day)), today };
}

/** Mi racha + qué días he hecho. */
export async function myStreak(supabase: SupabaseClient, userId: string) {
  const { days, done, today } = await myTrainingDays(supabase, userId);
  const stats: StreakStats = computeStreak(days, done, today);
  return { stats, done, today };
}

/** Ranking de constancia de todos los atletas. */
export async function streakStandings(supabase: SupabaseClient) {
  const today = todayISO();
  const [days, rows, profiles] = await Promise.all([
    trainingDays(supabase, today),
    doneRows(supabase, today),
    all<{ id: string; full_name: string; gender: "M" | "F" | null; avatar_url: string | null }>((a, b) =>
      supabase.from("profiles").select("id, full_name, gender, avatar_url").order("id").range(a, b),
    ),
  ]);
  const byUser = new Map<string, Set<string>>();
  for (const r of rows) (byUser.get(r.user_id) ?? byUser.set(r.user_id, new Set()).get(r.user_id)!).add(r.day);
  return rankStreaks(
    profiles.map((p) => ({
      user_id: p.id,
      name: p.full_name || "Sin nombre",
      gender: p.gender,
      avatar_url: p.avatar_url,
      ...computeStreak(days, byUser.get(p.id) ?? new Set(), today),
    })),
  );
}
