import { formatTime } from "./scoring";
import type { Gender, Result, ScoreType, Wod } from "./types";

/** Reglas del detector de resultados imposibles (puras, sin IA). */

/** Mensaje traducible: texto en español con {variables}. */
export type Msg = { msg: string; vars: Record<string, string | number> };
const m = (msg: string, vars: Msg["vars"]): Msg => ({ msg, vars });
/** El mensaje en español (para el coach y para la revisión). */
export const es = (x: Msg) => x.msg.replace(/\{(\w+)\}/g, (_, k) => String(x.vars[k] ?? "")).replace(/\s+:/g, ":");
// Mejores marcas aproximadas del mundo (elite masculino, en segundos o rondas). Más rápido que esto = imposible.
const BENCH_TIME: Record<string, number> = {
  fran: 105, grace: 55, isabel: 50, diane: 85, elizabeth: 120, helen: 330, karen: 270, jackie: 300,
  annie: 300, nancy: 480, murph: 1800, dt: 240, amanda: 150, randy: 150, kalsu: 600, "filthy fifty": 840,
};
const BENCH_ROUNDS: Record<string, number> = { cindy: 42, mary: 30, chelsea: 30 };
// Kilos máximos razonables (récords masculinos aproximados); en chicas se aplica 0,72
const LIFT_KG: [RegExp, number][] = [
  [/snatch|arranc/i, 200],
  [/clean|jerk|cargada|envi/i, 265],
  [/deadlift|peso muerto/i, 460],
  [/squat|sentadilla/i, 420],
  [/bench|press banca/i, 360],
  [/press|push press|thruster/i, 230],
];

export type Ctx = {
  wod: Pick<Wod, "title" | "description" | "score_type" | "score_label" | "time_cap_seconds" | "is_benchmark">;
  r: Result;
  gender: Gender | null;
  others: Result[]; // mismo WOD y división, sin el suyo
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/** Devuelve { hard } si es imposible sin discusión, { soft } si es raro y conviene que lo mire la IA, o null. */
export function rules({ wod, r, gender, others }: Ctx): { hard?: Msg; soft?: Msg } | null {
  const title = wod.title.toLowerCase().trim();
  const f = gender === "F" ? 0.72 : 1;
  const t = wod.score_type as ScoreType;
  if (t === "for_time" && r.finished && r.time_seconds != null) {
    const rec = BENCH_TIME[title];
    if (rec && r.time_seconds < rec) return { hard: m("{title} en {time}: más rápido que el récord mundial (~{rec}).", { title: wod.title, time: formatTime(r.time_seconds), rec: formatTime(rec) }) };
    if (r.time_seconds < 20) return { hard: m("Un WOD For Time en {s} s.", { s: r.time_seconds }) };
    const ts = others.filter((o) => o.finished && o.time_seconds != null).map((o) => o.time_seconds!);
    if (ts.length >= 3 && r.time_seconds < median(ts) * 0.5 && r.time_seconds < Math.min(...ts) * 0.75)
      return { soft: m("{v} frente a una mediana de {med} en el box (mejor: {best}).", { v: formatTime(r.time_seconds), med: formatTime(Math.round(median(ts))), best: formatTime(Math.min(...ts)) }) };
    return null;
  }
  if (t === "check") return null;
  if (t === "pace") {
    const s = r.time_seconds ?? 0;
    if (s > 0 && s < 150) return { hard: m("Ritmo de {v}/km: más rápido que el récord mundial.", { v: formatTime(s) }) };
    return null;
  }
  if (t === "amrap") {
    const rounds = r.rounds ?? 0;
    const rec = BENCH_ROUNDS[title];
    if (rec && rounds > rec) return { hard: m("{n} rondas en {title}: más que el récord mundial (~{rec}).", { n: rounds, title: wod.title, rec }) };
    if (rounds > 80) return { hard: m("{n} rondas en un AMRAP.", { n: rounds }) };
    const rs = others.map((o) => (o.rounds ?? 0) + (o.reps ?? 0) / 100);
    const mine = rounds + (r.reps ?? 0) / 100;
    if (rs.length >= 3 && mine > median(rs) * 2 && mine > Math.max(...rs) * 1.4)
      return { soft: m("{n} rondas frente a una mediana de {med} en el box.", { n: rounds, med: Math.round(median(rs)) }) };
    return null;
  }
  const v = Number(r.value ?? 0);
  if (t === "load") {
    for (const [re, kg] of LIFT_KG)
      if (re.test(title) || re.test(wod.description.slice(0, 80))) {
        if (v > kg * f) return { hard: m("{v} kg: por encima del récord mundial aproximado (~{kg} kg).", { v, kg: Math.round(kg * f) }) };
        break;
      }
    if (v > 500) return { hard: m("{v} kg: parece imposible.", { v }) };
  }
  const abs: Partial<Record<ScoreType, number>> = { reps: 5000, calories: 1500, distance: 60000, emom: 200 };
  if (abs[t] && v > abs[t]!) return { hard: m("{v} {unit}: parece imposible.", { v, unit: wod.score_label || "" }) };
  const vs = others.map((o) => Number(o.value ?? 0)).filter((x) => x > 0);
  if (vs.length >= 3 && v > median(vs) * 2.2 && v > Math.max(...vs) * 1.5)
    return { soft: m("{v} frente a una mediana de {med} en el box (mejor: {best}).", { v, med: Math.round(median(vs)), best: Math.max(...vs) }) };
  return null;
}

