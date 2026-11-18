import "server-only";

/** Modelo rápido y barato para los agentes de la app (consejos, revisiones, resúmenes). */
const FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5";

export const hasAi = () => !!process.env.ANTHROPIC_API_KEY;

/** Pregunta corta a Claude. Devuelve el texto o null si falla (los agentes nunca deben romper la app). */
export async function askAi(system: string, user: string, maxTokens = 400): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: FAST_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      console.error("askAi", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    return text || null;
  } catch (e) {
    console.error("askAi", e);
    return null;
  }
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
