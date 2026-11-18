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
 * Ranking acumulado de un periodo.
 * En cada WOD: puntos = participantes − posición + 1
 * (1 por participar + 1 por cada atleta que queda por detrás). Empates comparten puntos.
 */
export function computeStandings(wods: Wod[], results: Result[], gender: Gender | "all" = "all"): Standing[] {
  const byWod = new Map<string, Result[]>();
  for (const r of results) byWod.set(r.wod_id, [...(byWod.get(r.wod_id) ?? []), r]);

  const acc = new Map<string, Omit<Standing, "rank">>();
  for (const w of wods) {
    const ranked = rankResults(w, byWod.get(w.id) ?? [], { gender });
    const n = ranked.length;
    for (const r of ranked) {
      const s = acc.get(r.user_id) ?? {
        user_id: r.user_id,
        name: r.profiles?.full_name || "Sin nombre",
        avatar_url: r.profiles?.avatar_url ?? null,
        gender: r.profiles?.gender ?? null,
        points: 0,
        wods: 0,
        podiums: 0,
      };
      s.points += n - r.rank + 1;
      s.wods += 1;
      if (r.rank <= 3) s.podiums += 1;
      acc.set(r.user_id, s);
    }
    // Escalados: sin posición, pero 1 punto por participar
    for (const r of byWod.get(w.id) ?? []) {
      if (r.division !== "scaled" || (gender !== "all" && r.profiles?.gender !== gender)) continue;
      const s = acc.get(r.user_id) ?? {
        user_id: r.user_id,
        name: r.profiles?.full_name || "Sin nombre",
        avatar_url: r.profiles?.avatar_url ?? null,
        gender: r.profiles?.gender ?? null,
        points: 0,
        wods: 0,
        podiums: 0,
      };
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
