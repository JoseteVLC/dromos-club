import type { Benchmark } from "./marcas";

/** Levantamiento de un score de carga: qué ejercicio es (del catálogo de Mis marcas) y a cuántas reps (1RM, 3RM…). */
export type WodLift = { id: string; name: string; rm: number | null };

const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * En un WOD de fuerza («1 rep back squat / 1 rep bench press», «Find 3RM deadlift») busca los levantamientos del
 * catálogo en el orden en que salen: el primero va con el score 1 y el segundo con el score 2.
 * Si un nombre contiene a otro (Squat clean / Clean), gana el más largo.
 */
export function wodLifts(
  wod: { title: string; description: string; score_type: string; score2_type?: string | null },
  benches: Pick<Benchmark, "id" | "name" | "category">[],
): [WodLift | null, WodLift | null] {
  if (wod.score_type !== "load") return [null, null];
  const lifts = benches.filter((b) => b.category === "lifts" || b.category === "olympic");
  const lines = `${wod.title}\n${wod.description}`.split(/\r?\n/).map(norm);
  const descLines = norm(wod.description).split(/\r?\n/);
  const pick = (ls: string[]) => {
    const found: { at: number; line: number; b: (typeof lifts)[number] }[] = [];
    ls.forEach((line, li) => {
      const taken: [number, number][] = [];
      [...lifts]
        .sort((a, b) => b.name.length - a.name.length)
        .forEach((b) => {
          const n = norm(b.name).replace(/&/g, "(?:&|and|y)").replace(/\s+/g, "[\\s-]*");
          const m = new RegExp(`\\b${n}\\b`).exec(line);
          if (!m) return;
          const [s, e] = [m.index, m.index + m[0].length];
          if (taken.some(([a, z]) => s < z && e > a)) return;
          taken.push([s, e]);
          if (!found.some((f) => f.b.id === b.id)) found.push({ at: li * 10000 + s, line: li, b });
        });
    });
    return found.sort((a, b) => a.at - b.at);
  };
  // Primero en el enunciado (línea a línea); si no hay nada, en el título
  let found = pick(descLines).map((f) => ({ ...f, text: descLines[f.line] }));
  if (!found.length) found = pick([lines[0]]).map((f) => ({ ...f, text: lines[0] }));
  const all = norm(`${wod.title} ${wod.description}`);
  const globalRm = /\b(\d{1,2})\s*-?\s*rm\b/.exec(all)?.[1] ?? (/\b(?:1\s*rep\s*max|max(?:imo)?\s+single)\b/.test(all) ? "1" : null);
  const toLift = (f?: (typeof found)[number]): WodLift | null => {
    if (!f) return null;
    // Reps del propio renglón («1 reps BACK SQUAT», «Back squat 3RM»); si no, las del WOD («Find 1RM»)
    const own = /\b(\d{1,2})\s*(?:-?\s*rm\b|reps?\b|rep\b)/.exec(f.text)?.[1];
    const rm = Number(own ?? globalRm ?? NaN);
    return { id: f.b.id, name: f.b.name, rm: Number.isFinite(rm) && rm >= 1 && rm <= 20 ? rm : null };
  };
  return [toLift(found[0]), wod.score2_type === "load" ? toLift(found[1]) : null];
}
