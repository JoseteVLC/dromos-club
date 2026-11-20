import { compareScore, formatScore } from "./scoring";
import type { Profile, Result, ScoreType } from "./types";
import type { IconName } from "@/components/icon";

export type BenchCategory = "girls" | "heroes" | "classics" | "lifts" | "olympic" | "gymnastics" | "endurance";

/** emoji: para los desplegables (texto); icon: icono a color de la app */
export const BENCH_CATEGORIES: { value: BenchCategory; label: string; emoji: string; icon: IconName }[] = [
  { value: "girls", label: "Girls", emoji: "👩", icon: "sparkles" },
  { value: "heroes", label: "Héroes", emoji: "🎖️", icon: "shield" },
  { value: "classics", label: "Clásicos", emoji: "🔥", icon: "flame" },
  { value: "lifts", label: "Básicos", emoji: "🏋️", icon: "dumbbell" },
  { value: "olympic", label: "Halterofilia", emoji: "🥇", icon: "weight" },
  { value: "gymnastics", label: "Gimnásticos", emoji: "🤸", icon: "person" },
  { value: "endurance", label: "Cardio", emoji: "🚣", icon: "heart" },
];

/** Categorías de levantamientos: se apuntan como RM (1RM, 3RM, 5RM…). */
export const RM_CATEGORIES: BenchCategory[] = ["lifts", "olympic"];
/** Categorías con RX / Escalado (WODs con peso y movimientos prescritos). */
export const RX_CATEGORIES: BenchCategory[] = ["girls", "heroes", "classics"];

export type Benchmark = {
  id: string;
  category: BenchCategory;
  name: string;
  description: string;
  score_type: ScoreType;
  sort: number;
};

export type PersonalRecord = {
  id: string;
  user_id: string;
  benchmark_id: string;
  performed_on: string;
  division: "rx" | "scaled";
  rm: number | null;
  finished: boolean;
  time_seconds: number | null;
  rounds: number | null;
  reps: number | null;
  value: number | null;
  notes: string | null;
  profiles?: Pick<Profile, "full_name" | "gender" | "avatar_url"> | null;
};

/** Para reutilizar el cálculo de puntuaciones de los WODs. */
export function asResult(pr: PersonalRecord): Result {
  return {
    id: pr.id,
    wod_id: pr.benchmark_id,
    user_id: pr.user_id,
    division: pr.division,
    finished: pr.finished,
    time_seconds: pr.time_seconds,
    rounds: pr.rounds,
    reps: pr.reps,
    value: pr.value,
    notes: pr.notes,
    profiles: pr.profiles ?? null,
  };
}

export const unitFor = (b: Pick<Benchmark, "score_type">) =>
  b.score_type === "load" ? "kg" : b.score_type === "distance" ? "m" : b.score_type === "calories" ? "cal" : b.score_type === "reps" || b.score_type === "emom" ? "reps" : null;

export function formatPR(b: Pick<Benchmark, "score_type">, pr: PersonalRecord): string {
  return formatScore({ score_type: b.score_type, score_label: unitFor(b) }, asResult(pr));
}

/** Ordena de mejor a peor: RX antes que escalado y, dentro, la mejor marca. */
export function comparePR(b: Pick<Benchmark, "score_type">, x: PersonalRecord, y: PersonalRecord): number {
  if (x.division !== y.division) return x.division === "rx" ? -1 : 1;
  return compareScore(b.score_type, asResult(x), asResult(y));
}

/** Mejor marca de una lista (o null). */
export function bestPR(b: Pick<Benchmark, "score_type">, prs: PersonalRecord[]): PersonalRecord | null {
  return prs.length ? [...prs].sort((x, y) => comparePR(b, x, y))[0] : null;
}
