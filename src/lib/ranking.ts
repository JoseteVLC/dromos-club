import { rankResults } from "./scoring";
import type { Gender, Result, Wod } from "./types";

export type Standing = {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  gender: Gender | null;
  points: number;
  wods: number;
  podiums: number;
  rank: number;
};

/**
 * Puntos de una posición en un WOD con n atletas clasificados (por tramos, no por atletas que quedan detrás,
 * para que no se disparen cuando hay mucha gente): 1 por participar, +1 mitad de arriba, +1 top 25 %,
 * +1 top 10 % (los tramos desde 4 atletas) y +3/+2/+1 por podio (desde 3 atletas). Máximo 7.
 */
export function wodPoints(rank: number, n: number): number {
  let p = 1;
  if (n >= 4) {
    if (rank <= Math.ceil(n * 0.5)) p++;
    if (rank <= Math.ceil(n * 0.25)) p++;
    if (rank <= Math.ceil(n * 0.1)) p++;
  }
  if (n >= 3 && rank <= 3) p += 4 - rank;
  return p;
}

/**
 * Ranking acumulado de un periodo (semana, mes o año).
 * WODs con clasificación: `wodPoints`. Empates comparten posición y puntos.
 * Escalado: 1 punto. Partes de «Hecho»: 1 punto al día como mucho, aunque el día tenga varias.
 */
export function computeStandings(wods: Wod[], results: Result[], gender: Gender | "all" = "all"): Standing[] {
  const byWod = new Map<string, Result[]>();
  for (const r of results) byWod.set(r.wod_id, [...(byWod.get(r.wod_id) ?? []), r]);

  const acc = new Map<string, Omit<Standing, "rank">>();
  const checkDays = new Set<string>();
  const entry = (r: Result) =>
    acc.get(r.user_id) ?? {
      user_id: r.user_id,
      name: r.profiles?.full_name || "Sin nombre",
      avatar_url: r.profiles?.avatar_url ?? null,
      gender: r.profiles?.gender ?? null,
      points: 0,
      wods: 0,
      podiums: 0,
    };
  for (const w of wods) {
    const ranked = rankResults(w, byWod.get(w.id) ?? [], { gender });
    const check = w.score_type === "check";
    for (const r of ranked) {
      const s = entry(r);
      if (check) {
        const k = `${r.user_id}|${w.wod_date}`;
        if (!checkDays.has(k)) {
          checkDays.add(k);
          s.points += 1;
        }
      } else {
        s.points += wodPoints(r.rank, ranked.length);
        if (r.rank <= 3 && ranked.length >= 3) s.podiums += 1;
      }
      s.wods += 1;
      acc.set(r.user_id, s);
    }
    // Escalados: sin posición, pero 1 punto por participar
    for (const r of byWod.get(w.id) ?? []) {
      if (r.division !== "scaled" || (gender !== "all" && r.profiles?.gender !== gender)) continue;
      const s = entry(r);
      s.points += 1;
      s.wods += 1;
      acc.set(r.user_id, s);
    }
  }

  const sorted = [...acc.values()].sort(
    (a, b) => b.points - a.points || b.wods - a.wods || a.name.localeCompare(b.name),
  );
  const out: Standing[] = [];
  sorted.forEach((s, i) => {
    const prev = out[i - 1];
    out.push({ ...s, rank: prev && prev.points === s.points ? prev.rank : i + 1 });
  });
  return out;
}
