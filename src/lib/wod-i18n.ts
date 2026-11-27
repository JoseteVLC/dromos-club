import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { askAi, hasAi, parseJson } from "@/lib/ai";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";
import type { Lang } from "@/lib/i18n/core";
import type { Wod } from "@/lib/types";

/**
 * La plani en el idioma de cada atleta.
 * Cada WOD guarda sus traducciones en `wods.i18n` ({ h: huella del texto en español, en: {...}, fr: {...}, pl: {...} }).
 * Si el coach cambia el texto, la huella cambia y se vuelve a traducir. Mientras no hay traducción se ve en español.
 */
const FIELDS = ["title", "description", "score_name", "score2_name"] as const;
type Field = (typeof FIELDS)[number];
type Texts = Partial<Record<Field, string>>;
type I18n = { h?: string } & Partial<Record<"en" | "fr" | "pl", Texts>>;
const TARGETS = ["en", "fr", "pl"] as const;


type WithI18n = Wod & { i18n?: I18n | null };

function source(w: Wod): Texts {
  const out: Texts = {};
  for (const f of FIELDS) {
    const v = (w as Record<Field, string | null | undefined>)[f];
    if (v && v.trim()) out[f] = v;
  }
  return out;
}

function hashOf(w: Wod): string {
  return createHash("sha1").update(JSON.stringify(source(w))).digest("hex").slice(0, 16);
}

/** Devuelve los WODs con el texto en el idioma pedido (si ya está traducido) y encarga traducir los que falten. */
export function localizeWods<T extends Wod>(wods: T[], lang: Lang): T[] {
  if (lang === "es" || !wods.length) return wods;
  const missing: string[] = [];
  const out = wods.map((w) => {
    const i = (w as WithI18n).i18n;
    const tr = i && i.h === hashOf(w) ? i[lang] : undefined;
    if (!tr) {
      missing.push(w.id);
      return w;
    }
    return { ...w, ...tr };
  });
  if (missing.length && hasAi() && hasAdminKey()) after(() => translateWods(missing));
  return out;
}

/** Traduce (o vuelve a traducir) los WODs indicados a los tres idiomas y lo guarda. Nunca rompe nada si falla. */
export async function translateWods(ids: string[]): Promise<void> {
  if (!ids.length || !hasAi() || !hasAdminKey()) return;
  const db = adminDb();
  const { data } = await db.from("wods").select("*").in("id", ids).returns<WithI18n[]>();
  const todo = (data ?? []).filter((w) => w.i18n?.h !== hashOf(w) || TARGETS.some((l) => !w.i18n?.[l]));
  // De pocos en pocos para que la respuesta no sea enorme
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    const input = Object.fromEntries(batch.map((w) => [w.id, source(w)]));
    const text = await askAi(
      [
        "You translate CrossFit workout programming from Spanish into English, French and Polish for athletes.",
        "Keep exactly the same line breaks, numbering, bullet marks, spacing and order.",
        "Keep numbers, weights, units, times, percentages, reps and rep schemes (21-15-9) exactly as they are.",
        "Keep standard CrossFit terms the way athletes say them in that language; most movement names stay in English (Thruster, Wall ball, Burpee, Pull up, Clean & Jerk, Snatch, Double unders) and so do formats (AMRAP, EMOM, For Time, RX, Time cap, RM).",
        "Benchmark names (Fran, Murph, Cindy…) never change.",
        'Answer only with JSON: {"<id>": {"en": {...}, "fr": {...}, "pl": {...}}}, each with the same keys it received.',
      ].join(" "),
      JSON.stringify(input),
      Math.min(6000, 600 + JSON.stringify(input).length * 4),
    );
    const parsed = parseJson<Record<string, Partial<Record<(typeof TARGETS)[number], Texts>>>>(text);
    if (!parsed) continue;
    for (const w of batch) {
      const tr = parsed[w.id];
      if (!tr) continue;
      const src = source(w);
      const i18n: I18n = { h: hashOf(w) };
      for (const l of TARGETS) {
        const t = tr[l];
        if (!t) continue;
        // Solo campos que existen en español y con texto
        const clean: Texts = {};
        for (const f of Object.keys(src) as Field[]) if (typeof t[f] === "string" && t[f]!.trim()) clean[f] = t[f];
        i18n[l] = clean;
      }
      if (TARGETS.some((l) => i18n[l])) await db.from("wods").update({ i18n }).eq("id", w.id);
    }
  }
}
