import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askAi, parseJson } from "./ai";
import { formatScore, formatTime } from "./scoring";
import type { Gender, Result, Wod } from "./types";
import { es, rules, type Ctx, type Msg } from "./plausibility-rules";

/**
 * Detector de resultados imposibles.
 * 1) Reglas: récords mundiales aproximados de benchmarks y levantamientos, límites absolutos
 *    y comparación con el resto del box y con el historial del atleta.
 * 2) Si la sospecha viene solo de la comparación (no de un récord), la IA mira el WOD entero y decide.
 */

const SYSTEM = (lang: string) => `Revisas resultados de un leaderboard de CrossFit. Te paso el WOD, el resultado que acaba de escribir un atleta y cómo lo han hecho los demás.
Decide si es posible para una persona de box (no un atleta élite de los Games) o si casi seguro se ha equivocado al escribirlo (minutos y segundos cambiados, un cero de más, kilos en libras, rondas en vez de reps…).
Responde SOLO con JSON: {"plausible": true|false, "motivo": "una frase corta y natural en ${lang} dirigida al atleta, tuteando, como lo diría su coach: qué te ha llamado la atención y qué puede haber escrito mal. Sin emojis."}`;

export type Check = { reason: string; reasonEs: string; hard: boolean };
type Tr = (msg: string, vars?: Msg["vars"]) => string;
const LANG: Record<string, string> = { es: "español", en: "English", pl: "polski" };

/** Motivo de la duda (hard = imposible sin discusión) o null si el resultado es razonable. */
export async function checkResult(ctx: Ctx, t: Tr = (x) => x, locale = "es"): Promise<Check | null> {
  if (ctx.r.division === "scaled") return null;
  const hit = rules(ctx);
  if (!hit) return null;
  if (hit.hard) return { reason: t(hit.hard.msg, hit.hard.vars), reasonEs: es(hit.hard), hard: true };
  const prompt = `WOD: ${ctx.wod.title}
Tipo de score: ${ctx.wod.score_type}${ctx.wod.time_cap_seconds ? ` · time cap ${formatTime(ctx.wod.time_cap_seconds)}` : ""}
Descripción:
${ctx.wod.description.slice(0, 1500)}

Resultado (${ctx.gender === "F" ? "chica" : ctx.gender === "M" ? "chico" : "?"}, ${ctx.r.division}): ${formatScore(ctx.wod, ctx.r)}${ctx.r.notes ? ` · notas: «${ctx.r.notes.slice(0, 200)}»` : ""}
Lo que ha saltado: ${es(hit.soft!)}
Resultados del resto en su división: ${ctx.others.slice(0, 25).map((o) => formatScore(ctx.wod, o)).join(", ")}`;
  const out = parseJson<{ plausible: boolean; motivo: string }>(await askAi(SYSTEM(LANG[locale] ?? "español"), prompt, 200));
  const fallback = { reason: t(hit.soft!.msg, hit.soft!.vars), reasonEs: es(hit.soft!), hard: false };
  if (!out) return fallback;
  return out.plausible ? null : { ...fallback, reason: (out.motivo || fallback.reason).slice(0, 300) };
}

/** Revisa un resultado antes de guardarlo (el WOD y lo que han hecho los demás se leen con la clave de servidor). */
export async function checkCandidate(db: SupabaseClient, wodId: string, userId: string, r: Result, t?: Tr, locale?: string): Promise<Check | null> {
  if (r.division === "scaled") return null;
  const [{ data: wod }, { data: rows }, { data: me }] = await Promise.all([
    db.from("wods").select("title, description, score_type, score_label, time_cap_seconds, is_benchmark").eq("id", wodId).single<Ctx["wod"]>(),
    db.from("results").select("*").eq("wod_id", wodId).neq("user_id", userId).eq("division", r.division).returns<Result[]>(),
    db.from("profiles").select("gender").eq("id", userId).maybeSingle<{ gender: Gender | null }>(),
  ]);
  if (!wod) return null;
  const others = (rows ?? []).filter((x) => !x.flag || x.flag_reviewed);
  return checkResult({ wod, r, gender: me?.gender ?? null, others }, t, locale);
}

type PRRow = { benchmark_id: string; rm: number | null; finished: boolean; time_seconds: number | null; rounds: number | null; reps: number | null; value: number | null; division: string; notes: string | null };

/**
 * Lo mismo para «Mis marcas»: récords mundiales y saltos enormes respecto a tu mejor marca anterior.
 * (Aquí no hay resto del box con quien comparar.)
 */
export async function checkPersonalRecord(
  db: SupabaseClient,
  userId: string,
  bench: { name: string; description: string | null; score_type: string },
  row: PRRow,
  editId: string,
  t?: Tr,
  locale?: string,
): Promise<Check | null> {
  if (row.division === "scaled") return null;
  const [{ data: me }, { data: prev }] = await Promise.all([
    db.from("profiles").select("gender").eq("id", userId).maybeSingle<{ gender: Gender | null }>(),
    db.from("personal_records").select("id, rm, finished, time_seconds, rounds, reps, value").eq("user_id", userId).eq("benchmark_id", row.benchmark_id).neq("division", "scaled").returns<(PRRow & { id: string })[]>(),
  ]);
  // Su historial hace de «resto»: si mejora muchísimo de golpe, salta la duda
  const history = (prev ?? []).filter((x) => x.id !== editId && (x.rm ?? null) === (row.rm ?? null));
  const fake = (x: Partial<PRRow>) => ({ id: "", wod_id: "", user_id: userId, division: "rx", notes: null, ...x }) as unknown as Result;
  const ctx = {
    wod: { title: bench.name, description: bench.description ?? "", score_type: bench.score_type as Wod["score_type"], score_label: null, time_cap_seconds: null, is_benchmark: true },
    r: fake(row),
    gender: me?.gender ?? null,
    others: history.length >= 1 ? [...history, ...history, ...history].map(fake) : [],
  };
  return checkResult(ctx, t, locale);
}
