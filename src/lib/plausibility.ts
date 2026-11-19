import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askAi, parseJson } from "./ai";
import { formatScore, formatTime } from "./scoring";
import type { Gender, Result } from "./types";
import { rules, type Ctx } from "./plausibility-rules";

/**
 * Detector de resultados imposibles.
 * 1) Reglas: récords mundiales aproximados de benchmarks y levantamientos, límites absolutos
 *    y comparación con el resto del box y con el historial del atleta.
 * 2) Si la sospecha viene solo de la comparación (no de un récord), la IA mira el WOD entero y decide.
 */

const SYSTEM = `Revisas resultados de un leaderboard de CrossFit. Te paso el WOD, el resultado que acaba de escribir un atleta y cómo lo han hecho los demás.
Decide si es posible para una persona de box (no un atleta élite de los Games) o si casi seguro se ha equivocado al escribirlo (minutos y segundos cambiados, un cero de más, kilos en libras, rondas en vez de reps…).
Responde SOLO con JSON: {"plausible": true|false, "motivo": "una frase corta y natural dirigida al atleta, tuteando, como lo diría su coach: qué te ha llamado la atención y qué puede haber escrito mal. Sin emojis."}`;

export type Check = { reason: string; hard: boolean };

/** Motivo de la duda (hard = imposible sin discusión) o null si el resultado es razonable. */
export async function checkResult(ctx: Ctx): Promise<Check | null> {
  if (ctx.r.division === "scaled") return null;
  const hit = rules(ctx);
  if (!hit) return null;
  if (hit.hard) return { reason: hit.hard, hard: true };
  const prompt = `WOD: ${ctx.wod.title}
Tipo de score: ${ctx.wod.score_type}${ctx.wod.time_cap_seconds ? ` · time cap ${formatTime(ctx.wod.time_cap_seconds)}` : ""}
Descripción:
${ctx.wod.description.slice(0, 1500)}

Resultado (${ctx.gender === "F" ? "chica" : ctx.gender === "M" ? "chico" : "?"}, ${ctx.r.division}): ${formatScore(ctx.wod, ctx.r)}${ctx.r.notes ? ` · notas: «${ctx.r.notes.slice(0, 200)}»` : ""}
Lo que ha saltado: ${hit.soft}
Resultados del resto en su división: ${ctx.others.slice(0, 25).map((o) => formatScore(ctx.wod, o)).join(", ")}`;
  const out = parseJson<{ plausible: boolean; motivo: string }>(await askAi(SYSTEM, prompt, 200));
  if (!out) return { reason: hit.soft!, hard: false };
  return out.plausible ? null : { reason: (out.motivo || hit.soft!).slice(0, 300), hard: false };
}

/** Revisa un resultado antes de guardarlo (el WOD y lo que han hecho los demás se leen con la clave de servidor). */
export async function checkCandidate(db: SupabaseClient, wodId: string, userId: string, r: Result): Promise<Check | null> {
  if (r.division === "scaled") return null;
  const [{ data: wod }, { data: rows }, { data: me }] = await Promise.all([
    db.from("wods").select("title, description, score_type, score_label, time_cap_seconds, is_benchmark").eq("id", wodId).single<Ctx["wod"]>(),
    db.from("results").select("*").eq("wod_id", wodId).neq("user_id", userId).eq("division", r.division).returns<Result[]>(),
    db.from("profiles").select("gender").eq("id", userId).maybeSingle<{ gender: Gender | null }>(),
  ]);
  if (!wod) return null;
  const others = (rows ?? []).filter((x) => !x.flag || x.flag_reviewed);
  return checkResult({ wod, r, gender: me?.gender ?? null, others });
}
