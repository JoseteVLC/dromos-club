import type { Division, Gender, Result, ScoreType, Wod } from "./types";
import { SCORE_TYPES } from "./types";

export const DIVISION_ORDER: Record<Division, number> = { elite: 0, rx: 1, scaled: 2 };

/** "12:34" | "1:02:03" | "754" → segundos. Devuelve null si no es válido. */
export function parseTime(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

/** Texto del score para mostrar en el leaderboard. */
export function formatScore(wod: Pick<Wod, "score_type" | "score_label">, r: Result): string {
  switch (wod.score_type) {
    case "for_time":
      if (r.finished && r.time_seconds != null) return formatTime(r.time_seconds);
      return `CAP + ${r.reps ?? 0} reps`;
    case "amrap":
      return `${r.rounds ?? 0} + ${r.reps ?? 0}`;
    default: {
      const unit = wod.score_label || SCORE_TYPES[wod.score_type].unit || "";
      return `${fmtNum(Number(r.value ?? 0))} ${unit}`.trim();
    }
  }
}

/**
 * Compara dos resultados del mismo WOD dentro de la misma división.
 * Negativo = a va por delante de b.
 */
export function compareScore(type: ScoreType, a: Result, b: Result): number {
  switch (type) {
    case "for_time": {
      const aDone = a.finished && a.time_seconds != null;
      const bDone = b.finished && b.time_seconds != null;
      if (aDone && bDone) return a.time_seconds! - b.time_seconds!;
      if (aDone !== bDone) return aDone ? -1 : 1;
      return (b.reps ?? 0) - (a.reps ?? 0);
    }
    case "amrap": {
      const dr = (b.rounds ?? 0) - (a.rounds ?? 0);
      return dr !== 0 ? dr : (b.reps ?? 0) - (a.reps ?? 0);
    }
    default:
      return Number(b.value ?? 0) - Number(a.value ?? 0);
  }
}

export type RankedResult = Result & { rank: number; display: string };

/** Texto del segundo score (o null si el WOD no tiene o el atleta no lo metió). */
export function formatScore2(wod: Pick<Wod, "score2_type" | "score2_label">, r: Result): string | null {
  if (!wod.score2_type || r.value2 == null) return null;
  const unit = wod.score2_label || SCORE_TYPES[wod.score2_type].unit || "";
  return `${fmtNum(Number(r.value2))} ${unit}`.trim();
}

/**
 * Ordena y numera (los escalados no entran: cada uno escala a su manera). Elite > RX como bloques; dentro de cada bloque, por score.
 * Empates comparten posición (1, 2, 2, 4).
 */
export function rankResults(
  wodIn: Pick<Wod, "score_type" | "score_label" | "score2_type" | "score2_label">,
  resultsIn: Result[],
  filters: { gender?: Gender | "all"; division?: Division | "all"; score?: 1 | 2 } = {},
): RankedResult[] {
  const { gender = "all", division = "all", score = 1 } = filters;
  // Ranking del segundo score: se trata como un WOD numérico con value = value2
  const second = score === 2 && !!wodIn.score2_type;
  const wod = second ? { score_type: wodIn.score2_type as ScoreType, score_label: wodIn.score2_label ?? null } : wodIn;
  const results = second
    ? resultsIn.filter((r) => r.value2 != null).map((r) => ({ ...r, value: r.value2 ?? null }))
    : resultsIn;
  const filtered = results.filter(
    (r) =>
      r.division !== "scaled" &&
      (gender === "all" || r.profiles?.gender === gender) &&
      (division === "all" || r.division === division),
  );

  const cmp = (a: Result, b: Result) =>
    DIVISION_ORDER[a.division] - DIVISION_ORDER[b.division] || compareScore(wod.score_type, a, b);

  const sorted = [...filtered].sort(cmp);
  const ranked: RankedResult[] = [];
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    const rank = prev && cmp(prev, r) === 0 ? ranked[i - 1].rank : i + 1;
    ranked.push({ ...r, rank, display: formatScore(wod, r) });
  });
  return ranked;
}
