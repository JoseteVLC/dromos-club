import "server-only";
import { askAi } from "./ai";
import { langName, voice } from "./coach-voice";
import { formatTime } from "./scoring";
import type { Wod } from "./types";


const SYSTEM = (lang: string) => `Eres coach de CrossFit. Antes de cada sesión el box ya hace un calentamiento general de unos 10 minutos (foam roller, movilidad, activación general).
Propón en ${lang} un calentamiento ESPECÍFICO para el WOD que te paso, de 6 a 10 minutos, para hacerlo justo antes:
- preparación de los movimientos del WOD (versiones suaves, técnica, rango de movimiento),
- si hay carga, series de aproximación concretas (barra vacía, luego % del peso de trabajo) hasta acercarse al peso del WOD,
- si es un metcon, una o dos rondas cortas a ritmo suave para encontrar el ritmo.
Escribe como lo diría el coach en la pizarra: de 3 a 6 líneas con guiones simples, con reps, tiempos y pesos concretos. Sin emojis, sin títulos, sin negritas ni formato, sin introducción ni despedida. No repitas el calentamiento general.`;

/** Calentamiento específico para un WOD (corto, de coach). */
export async function makeWarmup(wod: Wod, rest: { part: string; title: string }[], locale: string): Promise<string | null> {
  const prompt = `WOD (parte ${wod.part}): ${wod.title}
Tipo de score: ${wod.score_type}${wod.time_cap_seconds ? ` · time cap ${formatTime(wod.time_cap_seconds)}` : ""}
${wod.description.slice(0, 2500)}
${rest.length ? `\nEl mismo día también hay: ${rest.map((r) => `${r.part} ${r.title}`).join(" · ")}` : ""}`;
  return askAi(`${SYSTEM(langName(locale))}\n\n${voice(locale)}`, prompt, 450);
}
