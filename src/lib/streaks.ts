/**
 * Rachas tipo Duolingo sobre los días de plani.
 * - Día de plani = día con algún WOD publicado. Los días sin plani (descanso) no rompen la racha.
 * - Día hecho = has metido algún resultado en un WOD de ese día.
 * - Hoy todavía no cuenta como fallo: la racha sigue viva hasta que acaba el día.
 */
export type StreakStats = { current: number; best: number; total: number; lastDone: string | null };

export function computeStreak(trainingDays: string[], done: Set<string>, today: string): StreakStats {
  let run = 0;
  let best = 0;
  let total = 0;
  let lastDone: string | null = null;
  for (const d of [...trainingDays].sort()) {
    if (d > today) break;
    if (done.has(d)) {
      run++;
      total++;
      lastDone = d;
      if (run > best) best = run;
    } else if (d < today) {
      run = 0;
    }
  }
  return { current: run, best, total, lastDone };
}

export type StreakRow = StreakStats & { user_id: string; name: string; gender: "M" | "F" | null; avatar_url?: string | null; rank: number };

/** Ranking de constancia: racha actual, luego récord, luego días totales. */
export function rankStreaks(rows: Omit<StreakRow, "rank">[]): StreakRow[] {
  const sorted = rows
    .filter((r) => r.total > 0)
    .sort((a, b) => b.current - a.current || b.best - a.best || b.total - a.total || a.name.localeCompare(b.name));
  const out: StreakRow[] = [];
  sorted.forEach((r, i) => {
    const p = out[i - 1];
    out.push({ ...r, rank: p && p.current === r.current && p.best === r.best && p.total === r.total ? p.rank : i + 1 });
  });
  return out;
}
