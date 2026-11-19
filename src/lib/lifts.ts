import type { SupabaseClient } from "@supabase/supabase-js";
import { RM_CATEGORIES, type Benchmark, type PersonalRecord } from "./marcas";

/** 1RM estimado (Epley); con 1RM devuelve el propio peso. */
export const epley = (r: Pick<PersonalRecord, "value" | "rm">) => {
  const w = Number(r.value ?? 0);
  const n = r.rm ?? 1;
  return n <= 1 ? w : w * (1 + n / 30);
};

export type Lift = { name: string; oneRM: number };

/** Tus básicos y levantamientos de halterofilia con su 1RM (real o estimado), para la calculadora de discos. */
export async function myLifts(supabase: SupabaseClient, userId: string): Promise<Lift[]> {
  const [{ data: benches }, { data: prs }] = await Promise.all([
    supabase.from("benchmarks").select("id, name, category, sort").in("category", RM_CATEGORIES).order("sort").order("name").returns<Pick<Benchmark, "id" | "name" | "category">[]>(),
    supabase.from("personal_records").select("benchmark_id, value, rm").eq("user_id", userId).eq("division", "rx").not("value", "is", null).returns<Pick<PersonalRecord, "benchmark_id" | "value" | "rm">[]>(),
  ]);
  const best = new Map<string, number>();
  for (const r of prs ?? []) best.set(r.benchmark_id, Math.max(best.get(r.benchmark_id) ?? 0, epley(r)));
  return (benches ?? []).filter((b) => (best.get(b.id) ?? 0) > 0).map((b) => ({ name: b.name, oneRM: Math.round(best.get(b.id)! * 2) / 2 }));
}

const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** ¿El WOD lleva pesos? (score de carga, kilos, % o RM en el enunciado) */
export const wodHasLoad = (w: { title: string; description: string; score_type: string }) =>
  w.score_type === "load" || /\d\s*(kg|%)|\brm\b|\d\s*rm\b/i.test(`${w.title} ${w.description}`);

/** El movimiento de tus marcas que sale en el WOD (el nombre más largo que aparezca) y el primer % que pida. */
export function liftPreset(w: { title: string; description: string }, lifts: Lift[]) {
  const text = norm(`${w.title} ${w.description}`);
  let idx: number | undefined;
  let len = 0;
  lifts.forEach((l, i) => {
    const n = norm(l.name).replace(/\s+/g, " ").trim();
    if (n.length > len && text.includes(n)) {
      idx = i;
      len = n.length;
    }
  });
  const m = text.match(/(\d{2,3})\s*%/);
  const pct = m ? Number(m[1]) : undefined;
  return { initialLift: idx, initialPct: pct && pct >= 30 && pct <= 110 ? Math.round(pct / 5) * 5 : undefined };
}
