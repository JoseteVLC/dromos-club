/**
 * Dos rachas:
 * · Días seguidos (tipo Duolingo): días de plani seguidos con resultado. Los días sin plani no la rompen y hoy no cuenta como fallo hasta que acaba.
 * · Semanas de 5 días: semanas seguidas entrenando al menos 5 días (de lunes a domingo).
 * - Día de plani = día con algún WOD publicado. Día hecho = has metido algún resultado en un WOD de ese día.
 * - Objetivo de cada semana = 5 días, o todos los días de plani si esa semana hay menos (festivos, vacaciones).
 * - La semana en curso no rompe la racha hasta que acaba: cuenta en cuanto llegas al objetivo.
 * - Las semanas sin plani no rompen la racha.
 */
export const WEEK_GOAL = 5;

export type StreakStats = {
  days: number; // días de plani seguidos con resultado
  bestDays: number; // récord de días seguidos
  current: number; // semanas seguidas cumpliendo
  best: number; // récord de semanas seguidas
  total: number; // días entrenados en total
  lastDone: string | null;
  weekDone: number; // días hechos esta semana
  weekGoal: number; // objetivo de esta semana
};

/** Lunes (YYYY-MM-DD) de la semana de una fecha. */
export function weekOf(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function computeStreak(trainingDays: string[], done: Set<string>, today: string): StreakStats {
  const plan = new Map<string, number>();
  const hit = new Map<string, number>();
  let total = 0;
  let lastDone: string | null = null;
  for (const d of [...new Set(trainingDays)].sort()) {
    if (d > today) break;
    const w = weekOf(d);
    plan.set(w, (plan.get(w) ?? 0) + 1);
    if (done.has(d)) {
      hit.set(w, (hit.get(w) ?? 0) + 1);
      total++;
      lastDone = d;
    }
  }
  // Días seguidos
  let dRun = 0;
  let bestDays = 0;
  for (const d of [...new Set(trainingDays)].sort()) {
    if (d > today) break;
    if (done.has(d)) {
      dRun++;
      if (dRun > bestDays) bestDays = dRun;
    } else if (d < today) dRun = 0;
  }

  const thisWeek = weekOf(today);
  let run = 0;
  let best = 0;
  for (const w of [...plan.keys()].sort()) {
    // La semana en curso solo cuenta al llegar a 5 (aún no sabemos cuántos días de plani tendrá); las pasadas, con su plani real
    const goal = w === thisWeek ? WEEK_GOAL : Math.min(WEEK_GOAL, plan.get(w)!);
    if ((hit.get(w) ?? 0) >= goal) {
      run++;
      if (run > best) best = run;
    } else if (w < thisWeek) {
      run = 0;
    }
  }
  return { days: dRun, bestDays, current: run, best, total, lastDone, weekDone: hit.get(thisWeek) ?? 0, weekGoal: WEEK_GOAL };
}

export type StreakRow = StreakStats & { user_id: string; name: string; gender: "M" | "F" | null; avatar_url?: string | null; rank: number };

/** Ranking de constancia: días seguidos, luego récord de días, semanas de 5 y días totales. */
export function rankStreaks(rows: Omit<StreakRow, "rank">[]): StreakRow[] {
  const sorted = rows
    .filter((r) => r.total > 0)
    .sort((a, b) => b.days - a.days || b.bestDays - a.bestDays || b.current - a.current || b.total - a.total || a.name.localeCompare(b.name));
  const out: StreakRow[] = [];
  sorted.forEach((r, i) => {
    const p = out[i - 1];
    out.push({ ...r, rank: p && p.days === r.days && p.bestDays === r.bestDays && p.current === r.current && p.total === r.total ? p.rank : i + 1 });
  });
  return out;
}
