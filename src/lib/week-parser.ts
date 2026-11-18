import { addDays } from "./dates";
import type { ScoreType } from "./types";

export type ParsedWeek = { parts: ParsedPart[]; skipped: number };

export type ParsedPart = {
  key: string;
  include: boolean;
  wod_date: string;
  part: string;
  title: string;
  description: string;
  score_type: ScoreType | ""; // "" = sin detectar, lo elige el coach
  time_cap: string; // "mm:ss" o ""
  is_benchmark: boolean;
};

// ---------------------------------------------------------------------------
// Días
// ---------------------------------------------------------------------------

const DAYS: [RegExp, number][] = [
  [/^lunes|^monday|^mon\b|^lun\b/i, 0],
  [/^martes|^tuesday|^tue\b|^mar\b/i, 1],
  [/^mi[ée]rcoles|^wednesday|^wed\b|^mi[ée]\b/i, 2],
  [/^jueves|^thursday|^thu\b|^jue\b/i, 3],
  [/^viernes|^friday|^fri\b|^vie\b/i, 4],
  [/^s[áa]bado|^saturday|^sat\b|^s[áa]b\b/i, 5],
  [/^domingo|^sunday|^sun\b|^dom\b/i, 6],
];

const MONTHS: Record<string, number> = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7,
  aug: 8, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};

type DayInfo = { offset: number; month?: number; day?: number };

/** «Mon, Nov 9: completed by…», «Lunes 9/11», «Martes 14 de noviembre», «Día 3», «Sunday»… */
export function dayInfo(line: string): DayInfo | null {
  let s = line.trim().replace(/^[#*\-–—=\s]+/, "").replace(/[*=\-–—\s]+$/, "");
  // TrueCoach: «Mon, Nov 9: completed by Aaron» / «Wed, Nov 11: missed by Aaron»
  s = s.replace(/:\s*(?:completed|missed|scheduled|completado|no completado)\b.*$/i, "").replace(/:\s*$/, "");
  if (!s || s.length > 40) return null;
  const n = s.match(/^(?:d[ií]a|day)\s*(\d{1,2})$/i);
  if (n) return { offset: Math.max(0, Number(n[1]) - 1) };

  for (const [re, offset] of DAYS) {
    const m = s.match(re);
    if (!m) continue;
    const word = m[0] + (s.slice(m[0].length).match(/^[a-záéíóú]*/i)?.[0] ?? "");
    const rest = s.slice(word.length).trim();

    // Fecha detrás: «, Nov 9» | «9/11» | «14 de noviembre» | «(14)»
    const en = rest.match(/^,?\s*([a-záéíóú]{3,})\.?\s+(\d{1,2})$/i);
    const es = rest.match(/^,?\s*(\d{1,2})\s*(?:de\s+)?([a-záéíóú]{3,})$/i);
    const num = rest.match(/^,?\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-]\d{2,4})?$/);
    const mon = (w: string) => MONTHS[w.slice(0, 3).toLowerCase()];
    if (en && mon(en[1])) return { offset, month: mon(en[1]), day: Number(en[2]) };
    if (es && mon(es[2])) return { offset, month: mon(es[2]), day: Number(es[1]) };
    if (num) return { offset, day: Number(num[1]), month: Number(num[2]) };
    if (/^[\s,()\d]*$/.test(rest)) return { offset };
    // Nombre completo seguido de algo («Lunes - Fuerza»): vale; abreviatura («Sun salutation»): no
    if (word.length >= 5 && /^[\s\-–—:(]/.test(rest)) return { offset };
    return null;
  }
  return null;
}

/** Offset del día (0 = lunes) o null. */
export function dayHeader(line: string): number | null {
  return dayInfo(line)?.offset ?? null;
}

/** Fecha ISO para un día: la fecha escrita si la hay (año más cercano a la semana), si no lunes + offset. */
function resolveDate(info: DayInfo, weekStart: string): string {
  if (info.month && info.day) {
    const y = Number(weekStart.slice(0, 4));
    const candidates = [y - 1, y, y + 1].map((yy) => `${yy}-${String(info.month).padStart(2, "0")}-${String(info.day).padStart(2, "0")}`);
    const ref = new Date(weekStart + "T12:00:00Z").getTime();
    candidates.sort(
      (a, b) => Math.abs(new Date(a + "T12:00:00Z").getTime() - ref) - Math.abs(new Date(b + "T12:00:00Z").getTime() - ref),
    );
    if (!Number.isNaN(new Date(candidates[0] + "T12:00:00Z").getTime())) return candidates[0];
  }
  return addDays(weekStart, info.offset);
}

// ---------------------------------------------------------------------------
// Partes y secciones
// ---------------------------------------------------------------------------

/**
 * Cabecera de parte con letra:
 * «A) Back Squat», «B. Metcon», «Parte C - Fran», «A» sola en su línea (TrueCoach),
 * «A        STRENGTH:» (PDF de TrueCoach).
 */
export function partHeader(line: string): { letter: string; rest: string } | null {
  const t = line.replace(/\s+$/, "");
  let m = t.match(/^\s*([A-H])\s*$/);
  if (m) return { letter: m[1], rest: "" };
  m = t.match(/^\s*([A-H])(?:\t|\s{2,})(\S.*)$/);
  if (m) return { letter: m[1], rest: m[2].trim() };
  m = t.trim().match(/^(?:parte|part|bloque|block)?\s*([A-Ha-h])\d?\s*[).:\-–—]\s*(.*)$/i);
  if (m) return { letter: m[1].toUpperCase(), rest: m[2].trim() };
  return null;
}

const SECTION_WORDS =
  "warm[\\s-]?ups?|calentamientos?|activaci[oó]n|movilidad|mobility|cool[\\s-]?down|vuelta\\s+a\\s+la\\s+calma|" +
  "strength|fuerza|conditioning|condici[oó]n|acondicionamiento|metcon|wod|skills?|t[eé]cnica|" +
  "trabajo\\s+accesorio|accesorios?|accessor(?:y|ies)|gymnastics|gimnastics|gimn[aá]sticos?|gimnasia|" +
  "weightlifting|halterofilia|barbell\\s+strength|finisher|engine|core|strongman|run\\s+wod|power\\s+conditioning|" +
  "endurance|aer[oó]bico|chipper|benchmark";

/** Cabecera de sección: «Warmup», «STRENGTH:», «WOD for time», «WEIGHTLIFTING: SNATCH»… */
export function sectionHeader(line: string): string | null {
  const s = line.trim().replace(/^[#*\s]+/, "").replace(/[*\s]+$/, "");
  if (!s || s.length > 60) return null;
  return new RegExp(`^(?:${SECTION_WORDS})\\b`, "i").test(s) ? s : null;
}

const WARMUP =
  /\b(warm[\s-]?ups?|calentamientos?|activaci[oó]n|movilidad|mobility|cool[\s-]?down|vuelta\s+a\s+la\s+calma|stretch(?:ing)?|estiramientos?|foam\s+roller)\b/i;

const ACCESSORY = /^\s*(?:trabajo\s+accesorio|accesorios?|accessor(?:y|ies))\b/i;

/** Líneas de ruido al pegar/imprimir desde TrueCoach. */
function isNoise(line: string): boolean {
  const s = line.trim();
  return (
    /app\.truecoach\.co/i.test(s) ||
    /\|\s*truecoach\s*$/i.test(s) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}/.test(s) || // «14/11/26, 9:19» (cabecera de impresión)
    /^\d{1,3}\/\d{1,3}$/.test(s) || // «1/12» (número de página)
    /^sesi[oó]n\s*\d+$|^session\s*\d+$/i.test(s) ||
    /^descanso(?:\s+completo)?\b[\s:(\d\-–min')]*$/i.test(s) // «DESCANSO COMPLETO (10-15MIN)», «DESCANSO:» (día de descanso)
  );
}

// ---------------------------------------------------------------------------
// Tipo de score y time cap
// ---------------------------------------------------------------------------

const SCORE_RULES: [RegExp, ScoreType][] = [
  [/\bamrap\b/i, "amrap"],
  [/\bfor\s*time\b|\brft\b|\bpor\s+tiempo\b/i, "for_time"],
  [/\bemom\b|\be\d+mom\b|\bevery\s+\d+(?::\d{2})?\s*(?:min|')|\bcada\s+\d+\s*min/i, "emom"],
  [/\bfor\s+(?:load|weight)\b|\bfind\s+(?:a\s+)?heavy\b|\bbuild\s+to\b|\b\d\s*rm\b(?!\s*para)|\brep\s+max\b/i, "load"],
  [/\bfor\s+cal(?:orie)?s?\b|\bmax\s+cal(?:orie)?s?\b(?!\s+(?:row|ski|bike|echo))/i, "calories"],
  [/\bfor\s+(?:distance|meters|metros)\b|\bmax(?:ima)?\s+(?:distance|distancia|meters|metros)\b/i, "distance"],
  [/\bfor\s+reps\b|\bmax\s+reps\b/i, "reps"],
];

/**
 * Tipo de score SOLO si el texto lo dice. Mira las primeras líneas «de formato»
 * (ignora comentarios con *), y gana la que aparece antes. Si no hay nada claro → "".
 */
export function guessScoreType(text: string): ScoreType | "" {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("*"))
    .slice(0, 4);
  for (const l of lines) {
    let best: { idx: number; type: ScoreType } | null = null;
    for (const [re, type] of SCORE_RULES) {
      const m = l.match(re);
      if (m && (best === null || m.index! < best.idx)) best = { idx: m.index!, type };
    }
    if (best) return best.type;
  }
  return "";
}

export function guessTimeCap(text: string): string {
  const m = text.match(/(?:time\s*cap|\bcap\b|\btc\b)\s*[:=]?\s*(\d{1,2})(?::(\d{2}))?\s*(?:min|['’m])?/i);
  if (!m) return "";
  return `${Number(m[1])}:${m[2] ?? "00"}`;
}

// ---------------------------------------------------------------------------
// Títulos
// ---------------------------------------------------------------------------

const ACRONYMS = /\b(wod|emom|amrap|rft|rm|t2b|hspu|hsw|bmu|rmu|du|db|kb|ghd|s2oh|hpc|ohs|rir)\b/gi;

/** «RUN WOD: 3 rounds FOR TIME» → «Run WOD: 3 rounds for time»; «WOD 1: IBERIAN TEST» → «WOD 1: Iberian test». */
function tidy(s: string): string {
  const t = s.replace(/[*_#]+/g, "").replace(/[:\-–—\s]+$/, "").replace(/\s+/g, " ").trim();
  // Respeta lo escrito con mayúsculas normales («Back Squat»); normaliza lo gritado o lo mezclado
  const caps = t.match(/\b[A-ZÁÉÍÓÚÑ]{3,}\b/g)?.filter((w) => !new RegExp(`^${ACRONYMS.source.slice(3, -3)}$`, "i").test(w)) ?? [];
  const shouty = caps.length > 0 || /^[a-záéíóúñ]/.test(t);
  const base = shouty ? t.toLowerCase() : t;
  const cap = base.replace(/(^|:\s+)([a-záéíóúñ])/g, (_, a: string, b: string) => a + b.toUpperCase());
  return cap.replace(ACRONYMS, (w) => w.toUpperCase());
}

const GENERIC_HEAD = new RegExp(`^(?:${SECTION_WORDS})$`, "i");

/** Nombre propio entre comillas («Fran», "Cindy") en la cabecera o la primera línea (no en comentarios). */
function quotedName(lines: string[]): string | null {
  for (const l of lines.slice(0, 2)) {
    if (l.trim().startsWith("*")) continue;
    const m = l.match(/["“«]([^"“”»]{2,30})["”»]/);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Título: nombre entre comillas > cabecera específica («Weightlifting: Snatch», «WOD for time»)
 * > cabecera genérica + primera línea («Strength · EMOM 20MIN») > primera línea.
 */
function makeTitle(head: string, bodyLines: string[], part: string): string {
  // Primera línea con contenido real (ni comentarios «*» ni otra sección genérica como «CONDITIONING»)
  const first =
    bodyLines.find((l) => l.trim() && !l.trim().startsWith("*") && !GENERIC_HEAD.test(l.trim().replace(/[:\s]+$/, ""))) ?? "";
  const named = quotedName([head, first]);
  if (named) return named.slice(0, 60);
  // «CONDITIONING: RUN» + «WOD 1: IBERIAN THROWDOWN TEST» → el WOD manda
  const wodLine = first.trim().match(/^wod\s*\d*\s*:\s*\S/i);
  if (wodLine && new RegExp(`^(?:${SECTION_WORDS})\\b`, "i").test(head.trim())) return tidy(first).slice(0, 60);
  const h = tidy(head);
  const f = first.trim().replace(/[:\s]+$/, "").replace(/\s+/g, " ");
  if (h && !GENERIC_HEAD.test(h)) return h.slice(0, 60);
  if (h && f) return `${h} · ${f}`.slice(0, 60);
  return (h || f || `WOD ${part}`).slice(0, 60);
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

/**
 * Trocea una plani semanal pegada (texto de TrueCoach, PDF o escrita a mano) en días y partes.
 * - Días: «Mon, Nov 9: completed by…», «Lunes», «Martes 14/11», «Día 1»…
 * - Partes: letra («A», «A)», «B.», «Parte C -») o sección («Strength», «WOD for time», «Conditioning»…)
 * - Calentamientos y vuelta a la calma se descartan.
 * - Tipo de score solo si se indica en el texto.
 */
export function parseWeek(text: string, weekStart: string): ParsedWeek {
  let lines = text.replace(/\r/g, "").split("\n").filter((l) => !isNoise(l));
  // Portada del Word («PROGRAMA ELITE», «SEMANA», «objetivo»…): todo lo anterior al primer día se ignora
  const firstDay = lines.findIndex((l) => dayInfo(l));
  if (firstDay > 0) lines = lines.slice(firstDay);
  type Block = { date: string; head: string; body: string[]; lettered: boolean };
  const blocks: Block[] = [];
  let date = weekStart;
  let cur: Block | null = null;
  const hasBody = (b: Block) => b.body.some((l) => l.trim());

  const push = () => {
    if (cur && (hasBody(cur) || cur.head)) blocks.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const di = dayInfo(raw);
    if (di) {
      push();
      date = resolveDate(di, weekStart);
      continue;
    }
    const p = partHeader(raw);
    // «A) 1min: max 1DB snatch» dentro de un «EVERY 3MIN» es contenido, no una parte nueva
    if (p && cur && !cur.lettered && hasBody(cur) && /^\d/.test(p.rest)) {
      cur.body.push(raw.trim());
      continue;
    }
    if (p) {
      push();
      cur = { date, head: p.rest, body: [], lettered: true };
      continue;
    }
    const sec = sectionHeader(raw);
    if (sec) {
      // Cambio entre calentamiento y trabajo: si el bloque está vacío manda la nueva sección
      // («E · TRABAJO ACCESORIO» + «VUELTA A LA CALMA» → se descarta); si tiene texto, bloque nuevo
      if (cur && cur.head && WARMUP.test(cur.head) !== WARMUP.test(sec)) {
        if (!hasBody(cur)) {
          cur.head = sec;
          continue;
        }
        push();
      }
      if (cur && !hasBody(cur)) {
        // «A» + «STRENGTH:» → cabecera; «WEIGHTLIFTING: SNATCH» + «CONDITIONING» → primera línea
        if (!cur.head) cur.head = sec;
        else cur.body.push(sec);
        continue;
      }
      // Dentro de una parte con letra ya empezada, una sección es texto normal (salvo un calentamiento)
      if (cur && cur.lettered && !WARMUP.test(sec)) {
        cur.body.push(raw);
        continue;
      }
      push();
      cur = { date, head: sec, body: [], lettered: false };
      continue;
    }
    if (!cur) {
      if (!raw.trim()) continue;
      cur = { date, head: "", body: [], lettered: false };
    }
    cur.body.push(raw.replace(/^\s{1,24}/, ""));
  }
  push();

  let skipped = 0;
  const letters = new Map<string, number>();
  const parts: ParsedPart[] = [];
  blocks.forEach((b, i) => {
    const body = b.body.map((l) => l.replace(/\s+$/, ""));
    const description = body.join("\n").replace(/^\n+|\n+$/g, "").replace(/\n{3,}/g, "\n\n");
    const firstLine = body.find((l) => l.trim()) ?? "";
    if (WARMUP.test(b.head) || WARMUP.test(firstLine)) {
      skipped++;
      return;
    }
    // Accesorios y trabajo «for quality» no llevan leaderboard
    if (ACCESSORY.test(b.head) || (!b.head && ACCESSORY.test(firstLine))) {
      skipped++;
      return;
    }
    const formatLines = `${b.head}\n${description}`.split("\n").filter((l) => l.trim() && !l.trim().startsWith("*")).slice(0, 3).join("\n");
    const qualityType = guessScoreType(formatLines.replace(/\bfor\s+quality\b/gi, ""));
    if (/\bfor\s+quality\b/i.test(formatLines) && (!qualityType || qualityType === "emom")) {
      skipped++;
      return;
    }
    const n = letters.get(b.date) ?? 0;
    letters.set(b.date, n + 1);
    const part = String.fromCharCode(65 + Math.min(n, 25));
    const title = makeTitle(b.head, body, part);
    const headInfo = b.head.replace(/^[^:]*:\s*/, ""); // «WOD: for time» → «for time»
    const scoreSource = `${b.head.includes(":") ? headInfo : b.head}\n${description}`;
    let score_type = guessScoreType(scoreSource);
    // «EL RESULTADO ES: Ax1 + Bx2 + Cx3» dentro de un EMOM/EVERY: el resultado no es un EMOM, que elija el coach
    if (score_type === "emom" && /\b(?:el\s+)?resultado\s+es\b|\bscore\s+is\b/i.test(description)) score_type = "";
    parts.push({
      key: `${i}-${b.date}-${part}`,
      include: true,
      wod_date: b.date,
      part,
      title,
      description,
      score_type,
      time_cap: score_type === "for_time" ? guessTimeCap(description) : "",
      is_benchmark: false,
    });
  });
  return { parts, skipped };
}

/** Lunes de la semana de una fecha ISO. */
export function mondayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(iso, -dow);
}
