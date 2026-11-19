import "server-only";

/** Modelo rápido y barato para los agentes; si falla, se reintenta con el modelo principal de la app. */
const MODELS = [process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5", process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"];

export const hasAi = () => !!process.env.ANTHROPIC_API_KEY;

async function call(key: string, model: string, system: string, user: string, maxTokens: number): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      // Los modelos actuales razonan antes de contestar y eso también gasta tokens: margen de sobra y esfuerzo bajo
      max_tokens: maxTokens + 3000,
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) {
    console.error("askAi", model, res.status, (await res.text().catch(() => "")).slice(0, 400));
    return null;
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
  if (!text) console.error("askAi", model, "sin texto", json.stop_reason);
  return text || null;
}

/** Pregunta corta a Claude. Devuelve el texto o null si falla (los agentes nunca deben romper la app). */
export async function askAi(system: string, user: string, maxTokens = 400): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  for (const model of [...new Set(MODELS)]) {
    try {
      const out = await call(key, model, system, user, maxTokens);
      if (out) return out;
    } catch (e) {
      console.error("askAi", model, e);
    }
  }
  return null;
}

/** Saca el primer objeto JSON de una respuesta de texto. */
export function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
