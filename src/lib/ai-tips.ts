import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askAi } from "./ai";
import { formatTime } from "./scoring";
import type { Gender, Wod } from "./types";

type PR = { rm: number | null; value: number | null; time_seconds: number | null; rounds: number | null; reps: number | null; division: string; performed_on: string; benchmarks: { name: string; category: string; score_type: string } | null };
type LoadRes = { value: number | null; division: string; wods: { title: string; wod_date: string } };

const LANG: Record<string, string> = { es: "español", en: "English", pl: "polski" };

/** Lo que sabemos del atleta para afinar el consejo: mejores marcas y cargas recientes. */
async function athleteContext(db: SupabaseClient, userId: string, boxId: string) {
  const [{ data: prs }, { data: loads }, { data: prof }] = await Promise.all([
    db
      .from("personal_records")
      .select("rm, value, time_seconds, rounds, reps, division, performed_on, benchmarks!inner(name, category, score_type)")
      .eq("user_id", userId)
      .order("performed_on", { ascending: false })
      .limit(300)
      .returns<PR[]>(),
    db
      .from("results")
      .select("value, division, wods!inner(title, wod_date, score_type)")
      .eq("user_id", userId)
      .eq("box_id", boxId)
      .eq("wods.score_type", "load")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<LoadRes[]>(),
    db.from("profiles").select("gender, division").eq("id", userId).maybeSingle<{ gender: Gender | null; division: string | null }>(),
  ]);
  // Mejor marca por ejercicio (y por RM en levantamientos)
  const best = new Map<string, string>();
  for (const p of prs ?? []) {
    const b = p.benchmarks;
    if (!b) continue;
    const key = `${b.name}${p.rm ? ` ${p.rm}RM` : ""}`;
    const val =
      b.score_type === "for_time" ? (p.time_seconds ? formatTime(p.time_seconds) : null)
      : b.score_type === "amrap" ? `${p.rounds ?? 0}+${p.reps ?? 0}`
      : p.value != null ? `${p.value}${b.score_type === "load" ? " kg" : ""}` : null;
    if (!val) continue;
    const prev = best.get(key);
    // Para cargas nos quedamos con la mayor; para el resto, la más reciente (ya vienen ordenadas)
    if (!prev || (b.score_type === "load" && Number(p.value) > parseFloat(prev))) best.set(key, `${val} (${p.division}, ${p.performed_on})`);
  }
  return {
    gender: prof?.gender ?? null,
    division: prof?.division ?? null,
    prs: [...best].slice(0, 60).map(([k, v]) => `${k}: ${v}`),
    loads: (loads ?? []).map((l) => `${l.wods.wod_date} ${l.wods.title}: ${l.value} kg (${l.division})`),
  };
}

const SYSTEM = (lang: string) => `Eres coach de CrossFit en un box y hablas con un atleta antes de hacer el WOD del día.
Con el WOD y sus marcas, dale en ${lang} un consejo práctico y corto (máximo 6 líneas, sin títulos ni markdown salvo guiones):
- Peso concreto en kg para cada movimiento con carga: si la plani pide un % calcula con su RM (redondea a 2,5 kg) y si da peso RX/escalado elige el que le toca por sus marcas.
- Si debería escalar algo (peso, reps o movimiento), cómo.
- Una clave de estrategia (ritmo, cómo partir las series).
Si no tienes la marca que necesitas, dilo en una frase y explica cómo elegir el peso en el calentamiento. No inventes marcas que no te he dado. Tutea.`;

/** Consejo de peso y escalado para un WOD (lo genera la IA una vez por WOD y atleta). */
export async function makeTip(db: SupabaseClient, wod: Wod, userId: string, boxId: string, locale: string): Promise<string | null> {
  const a = await athleteContext(db, userId, boxId);
  const prompt = `WOD (${wod.wod_date}, parte ${wod.part}): ${wod.title}
Tipo de score: ${wod.score_type}${wod.time_cap_seconds ? ` · time cap ${formatTime(wod.time_cap_seconds)}` : ""}
${wod.description.slice(0, 2500)}

Atleta: ${a.gender === "F" ? "chica" : a.gender === "M" ? "chico" : "sin indicar"} · nivel habitual: ${a.division ?? "sin indicar"}
Sus mejores marcas:
${a.prs.length ? a.prs.join("\n") : "(no ha apuntado ninguna)"}
Cargas recientes en WODs del box:
${a.loads.length ? a.loads.join("\n") : "(ninguna)"}`;
  return askAi(SYSTEM(LANG[locale] ?? "español"), prompt, 450);
}
