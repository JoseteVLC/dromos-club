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

const SYSTEM = `Eres un juez de CrossFit que revisa resultados de un leaderboard de box. Te paso el WOD, el resultado de un atleta y cómo lo han hecho los demás.
Decide si el resultado es físicamente posible para una persona de box (no un atleta élite de los Games) o si casi seguro es un error al escribirlo (minutos y segundos cambiados, un cero de más, kilos en libras, rondas en vez de reps…).
Responde SOLO con JSON: {"plausible": true|false, "motivo": "frase corta en español explicando por qué es raro y qué error puede ser"}`;

/** Motivo del aviso o null si el resultado es razonable. */
export async function checkResult(ctx: Ctx): Promise<string | null> {
  if (ctx.r.division === "scaled") return null;
  const hit = rules(ctx);
  if (!hit) return null;
  if (hit.hard) return hit.hard;
  const prompt = `WOD: ${ctx.wod.title}
Tipo de score: ${ctx.wod.score_type}${ctx.wod.time_cap_seconds ? ` · time cap ${formatTime(ctx.wod.time_cap_seconds)}` : ""}
Descripción:
${ctx.wod.description.slice(0, 1500)}

Resultado a revisar (${ctx.gender === "F" ? "chica" : ctx.gender === "M" ? "chico" : "?"}, ${ctx.r.division}): ${formatScore(ctx.wod, ctx.r)}${ctx.r.notes ? ` · notas: «${ctx.r.notes.slice(0, 200)}»` : ""}
Lo que ha saltado: ${hit.soft}
Resultados del resto en su división: ${ctx.others.slice(0, 25).map((o) => formatScore(ctx.wod, o)).join(", ")}`;
  const out = parseJson<{ plausible: boolean; motivo: string }>(await askAi(SYSTEM, prompt, 200));
  if (!out) return hit.soft!; // sin IA, mejor que lo mire el coach
  return out.plausible ? null : (out.motivo || hit.soft!).slice(0, 300);
}

/**
 * Revisa el resultado recién guardado y deja (o quita) el aviso con la clave de servidor.
 * Devuelve el motivo si es un aviso nuevo, para avisar a los coaches.
 */
export async function reviewSavedResult(db: SupabaseClient, wodId: string, userId: string): Promise<{ reason: string; result: Result; wodTitle: string } | null> {
  const [{ data: wod }, { data: rows }] = await Promise.all([
    db.from("wods").select("title, description, score_type, score_label, time_cap_seconds, is_benchmark").eq("id", wodId).single<Ctx["wod"]>(),
    db.from("results").select("*, profiles!results_user_id_fkey(full_name, gender)").eq("wod_id", wodId).returns<Result[]>(),
  ]);
  const mine = (rows ?? []).find((x) => x.user_id === userId);
  if (!wod || !mine) return null;
  const others = (rows ?? []).filter((x) => x.user_id !== userId && x.division === mine.division && !x.flag);
  const reason = await checkResult({ wod, r: mine, gender: (mine.profiles?.gender ?? null) as Gender | null, others });
  // Si el coach ya lo dio por bueno y el motivo es el mismo (lo ha vuelto a guardar igual), se respeta
  const keepReviewed = !!reason && mine.flag_reviewed && mine.flag === reason;
  const wasNew = !!reason && !keepReviewed && mine.flag !== reason;
  await db.from("results").update({ flag: reason, flag_reviewed: keepReviewed }).eq("id", mine.id);
  return wasNew ? { reason, result: mine, wodTitle: wod.title } : null;
}
