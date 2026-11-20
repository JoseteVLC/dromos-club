import "server-only";
import { SCORE_TYPES, type ScoreType } from "./types";
import type { ParsedPart } from "./week-parser";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const TOOL = {
  name: "guardar_wods",
  description: "Guarda las partes con leaderboard leídas de la(s) foto(s).",
  input_schema: {
    type: "object",
    properties: {
      parts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string", description: "Fecha YYYY-MM-DD de esa parte. Si la foto no indica el día, usa la fecha por defecto." },
            part: { type: "string", description: "Letra de la parte: A, B, C… En orden de aparición dentro de cada día." },
            title: { type: "string", description: "Título corto. Si es un benchmark conocido, su nombre exacto (Fran, Grace, Murph, Back Squat 1RM…)." },
            description: { type: "string", description: "Texto completo del WOD tal cual, con saltos de línea: estructura, reps, movimientos, pesos (♂/♀), time cap." },
            score_type: { type: "string", enum: Object.keys(SCORE_TYPES), description: "for_time, amrap, load (kilos), reps, calories, distance, emom, pace (ritmo medio min/km) o check (solo marcar hecho)." },
            time_cap: { type: "string", description: "Solo en for_time: time cap en mm:ss si aparece. Si no, cadena vacía." },
            is_benchmark: { type: "boolean", description: "true si es un benchmark conocido (Girls, Heroes, 1RM de un básico…)." },
          },
          required: ["date", "part", "title", "description", "score_type", "time_cap", "is_benchmark"],
        },
      },
      notes: { type: "string", description: "Avisos para el coach si algo no se leía bien. Vacío si todo OK." },
    },
    required: ["parts", "notes"],
  },
};

const PROMPT = (defaultDate: string) => `Eres el asistente de un box de CrossFit. Te paso foto(s) de la pizarra del box o de la planificación (puede ser letra a mano, una pantalla o un papel).

Extrae SOLO las partes que tienen resultado para un leaderboard (metcons, levantamientos con marca, AMRAP, EMOM con score, benchmarks, strongman…).
SÍ incluye el trabajo «for quality» (p. ej. strongman o fuerza con pesos): el atleta apuntará el peso que ha usado o sus reps.
NO incluyas calentamiento, movilidad, activación, técnica sin carga, accesorios ni vuelta a la calma.

Para cada parte:
- date: si la foto indica el día (lunes, martes… o una fecha), conviértelo a fecha real tomando como referencia que la fecha por defecto es ${defaultDate}. Si no indica día, usa ${defaultDate}.
- part: A, B, C… en el orden en que aparecen ese día (respeta la letra si la pizarra la pone).
- title: corto y claro. Benchmarks con su nombre exacto.
- description: transcribe el WOD completo y fiel, con saltos de línea, sin inventar nada. Si algo no se lee, pon [ilegible].
- score_type: elige según cómo se puntúa: For Time → for_time; AMRAP → amrap; buscar peso/RM → load; máximo de reps → reps; calorías → calories; metros → distance; EMOM con score → emom; ritmo medio de carrera (min/km) → pace; trabajo sin marca que apuntar (técnica, movilidad) → check. «For quality» con pesos (yoke, sandbag, farmer, sled…) → load (el peso más alto que ha movido); si no hay peso, reps.
- time_cap: mm:ss solo si aparece (p. ej. "TC 12'" → "12:00").

Responde SIEMPRE llamando a la herramienta guardar_wods (aunque no encuentres nada: parts vacío y explícalo en notes).`;

export type PhotoResult = { parts: ParsedPart[]; notes: string } | { error: string };

/** Lee WODs de una o varias fotos con Claude (visión) y los devuelve con la misma forma que el importador de semana. */
export async function wodsFromPhotos(images: { data: string; type: string }[], defaultDate: string): Promise<PhotoResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "Falta configurar la clave de la IA (ANTHROPIC_API_KEY)." };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      // Leer una pizarra no necesita pensar mucho: sin razonamiento previo y esfuerzo bajo = respuesta en segundos
      thinking: { type: "between_tools" },
      output_config: { effort: "low" },
      tools: [TOOL],
      // Los modelos actuales piensan siempre: forzar una herramienta concreta no es compatible, así que va en auto
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.type, data: im.data } })),
            { type: "text", text: PROMPT(defaultDate) },
          ],
        },
      ],
    }),
  }).catch(() => null);
  if (!res) return { error: "La IA no ha podido leer la foto. Prueba otra vez o con una foto más nítida." };
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Anthropic API", res.status, detail);
    const msg = (() => {
      try {
        return JSON.parse(detail)?.error?.message as string;
      } catch {
        return "";
      }
    })();
    return { error: `La IA no ha podido leer la foto (${res.status}${msg ? `: ${msg}` : ""}).` };
  }
  const json = (await res.json()) as { content?: { type: string; input?: { parts?: Raw[]; notes?: string } }[] };
  const out = json.content?.find((c) => c.type === "tool_use")?.input;
  if (!out?.parts) return { error: "No he encontrado WODs en la foto." };
  const valid = Object.keys(SCORE_TYPES);
  const parts: ParsedPart[] = out.parts.map((p, i) => ({
    key: `photo-${i}-${Date.now()}`,
    include: true,
    wod_date: /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : defaultDate,
    part: (p.part || String.fromCharCode(65 + i)).toUpperCase().slice(0, 3),
    title: (p.title || "").slice(0, 120),
    description: (p.description || "").slice(0, 4000),
    score_type: (valid.includes(p.score_type) ? p.score_type : "") as ScoreType | "",
    time_cap: p.score_type === "for_time" && /^\d{1,3}:\d{2}$/.test(p.time_cap) ? p.time_cap : "",
    is_benchmark: !!p.is_benchmark,
  }));
  return { parts, notes: out.notes || "" };
}

type Raw = { date: string; part: string; title: string; description: string; score_type: string; time_cap: string; is_benchmark: boolean };
