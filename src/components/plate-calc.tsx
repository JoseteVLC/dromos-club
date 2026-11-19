"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/** Discos de un box (kg) y sus colores de competición. */
// Bumpers de box: de 10 a 25 kg tienen el mismo diámetro y cambia el grosor; los de 5 y los de cambio son más pequeños.
const PLATES: { kg: number; color: string; h: number; w: number; dark?: boolean }[] = [
  { kg: 25, color: "#c81e1e", h: 100, w: 22 },
  { kg: 20, color: "#1d4ed8", h: 100, w: 18 },
  { kg: 15, color: "#e3b505", h: 100, w: 15, dark: true },
  { kg: 10, color: "#15803d", h: 100, w: 12 },
  { kg: 5, color: "#e7e5e4", h: 72, w: 9, dark: true },
  { kg: 2.5, color: "#b91c1c", h: 52, w: 6 },
  { kg: 1.25, color: "#a8a29e", h: 42, w: 5, dark: true },
];
const BARS = [20, 15, 10];
const PCTS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 40];
const fmt = (n: number, locale: string) => n.toLocaleString(locale, { maximumFractionDigits: 2 });

/** Discos por lado para llegar a ese peso con esa barra (de mayor a menor). Lo que no cuadra se queda en «resto». */
export function platesFor(total: number, bar: number) {
  let side = Math.max(0, (total - bar) / 2);
  const out: number[] = [];
  for (const p of PLATES) {
    while (side + 1e-9 >= p.kg) {
      out.push(p.kg);
      side -= p.kg;
    }
  }
  return { plates: out, rest: Math.round(side * 2 * 100) / 100 };
}

/**
 * Calculadora de % y discos: eliges un % de tu 1RM (o escribes el peso) y te dice qué discos poner a cada lado.
 * Redondea a 2,5 kg (el menor salto con discos de 1,25).
 */
export function PlateCalc({
  oneRM,
  lifts,
  initialLift,
  initialPct,
}: {
  oneRM?: number | null;
  lifts?: { name: string; oneRM: number }[];
  /** Movimiento que sale en el WOD (índice en lifts), para tenerlo ya elegido */
  initialLift?: number;
  /** % que pide el WOD (p. ej. 90), para tenerlo ya marcado */
  initialPct?: number;
}) {
  const { t, locale } = useI18n();
  const list = lifts ?? [];
  // -1 = escribir tu RM a mano
  const [rmIdx, setRmIdx] = useState(oneRM ? -2 : list.length ? (initialLift ?? 0) : -1);
  const [rmTyped, setRmTyped] = useState("");
  const typedRM = Number(rmTyped.replace(",", "."));
  const base = rmIdx === -2 ? oneRM ?? null : rmIdx >= 0 ? list[rmIdx]?.oneRM ?? null : typedRM > 0 ? typedRM : null;
  const [pct, setPct] = useState<number | null>(initialPct ?? 75);
  const [manual, setManual] = useState<string>("");
  const [bar, setBar] = useState(20);

  const round25 = (kg: number) => Math.round(kg / 2.5) * 2.5;
  const fromPct = base && pct ? round25((base * pct) / 100) : null;
  const typed = Number(manual.replace(",", "."));
  const target = manual && Number.isFinite(typed) && typed > 0 ? typed : fromPct;
  const res = target != null ? platesFor(target, bar) : null;

  return (
    <div className="card space-y-4 p-4">
      {(list.length > 0 || oneRM) && (
        <label className="block">
          <span className="label">{t("Tu RM")}</span>
          <select
            className="input"
            value={rmIdx}
            onChange={(e) => {
              setRmIdx(Number(e.target.value));
              setManual("");
            }}
          >
            {oneRM ? <option value={-2}>{t("Tu 1RM")} · {fmt(oneRM, locale)} kg</option> : null}
            {list.map((l, i) => (
              <option key={l.name} value={i}>
                {l.name} · 1RM {fmt(l.oneRM, locale)} kg
              </option>
            ))}
            <option value={-1}>{t("Otro: escribo mi 1RM")}</option>
          </select>
        </label>
      )}
      {rmIdx === -1 && (
        <label className="block">
          <span className="label">{t("Tu 1RM (kg)")}</span>
          <input className="input" inputMode="decimal" placeholder="kg" value={rmTyped} onChange={(e) => setRmTyped(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} />
        </label>
      )}

      {base ? (
        <div className="space-y-2">
          <span className="label">{t("% de tu 1RM ({kg} kg)", { kg: fmt(base, locale) })}</span>
          <div className="grid grid-cols-4 gap-1.5">
            {PCTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPct(p);
                  setManual("");
                }}
                className={`rounded-md border px-1 py-1.5 text-center ${pct === p && !manual ? "border-accent bg-accent text-accent-fg" : "border-line"}`}
              >
                <div className="text-[11px] opacity-70">{p}%</div>
                <div className="text-sm font-semibold tabular-nums">{fmt(round25((base * p) / 100), locale)}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">{base ? t("O escribe el peso") : t("Peso en la barra")}</span>
          <input className="input" inputMode="decimal" placeholder="kg" value={manual} onChange={(e) => setManual(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} />
        </label>
        <div>
          <span className="label">{t("Barra")}</span>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-bg p-1">
            {BARS.map((b) => (
              <button key={b} type="button" onClick={() => setBar(b)} className={`rounded-md py-1.5 text-sm font-semibold ${bar === b ? "bg-accent text-accent-fg" : "text-muted"}`}>
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {res && target != null && (
        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-baseline justify-between">
            <span className="h-display text-3xl tabular-nums">{fmt(target, locale)} kg</span>
            <span className="text-xs text-muted">{t("barra de {b} kg", { b: bar })}</span>
          </div>
          {target < bar ? (
            <p className="text-sm text-muted">{t("Menos que la barra sola.")}</p>
          ) : res.plates.length === 0 ? (
            <p className="text-sm">{t("Solo la barra.")}</p>
          ) : (
            <>
              <BarSleeve plates={res.plates} />
              <p className="text-sm">
                <span className="text-muted">{t("Por lado")}:</span> <b className="tabular-nums">{res.plates.map((k) => fmt(k, locale)).join(" + ")}</b>
              </p>
            </>
          )}
          {res.rest > 0 && target >= bar && <p className="text-xs text-muted">{t("Con discos no se llega exacto: faltan {kg} kg.", { kg: fmt(res.rest, locale) })}</p>}
          <p className="text-[11px] text-muted">{t("Los cierres no cuentan: en CrossFit no pesan.")}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Un lado de la barra a escala: a la derecha el tope de la barra con los discos grandes pegados,
 * y hacia la izquierda, donde acaba la barra, los pequeños y el cierre.
 */
function BarSleeve({ plates }: { plates: number[] }) {
  const H = 110;
  const cy = H / 2;
  const gap = 1.5;
  const specs = plates.map((kg) => PLATES.find((p) => p.kg === kg)!);
  const stack = specs.reduce((a, p) => a + p.w + gap, 0);
  const clipW = 7;
  const endPad = 14; // barra libre tras el cierre
  const stopW = 8;
  const shaft = 46;
  const W = endPad + clipW + 3 + stack + stopW + shaft;
  const stopX = endPad + clipW + 3 + stack; // tope interior
  // Discos de dentro a fuera: el primero (el más pesado) pegado al tope
  const rects = specs.map((p, i) => {
    const used = specs.slice(0, i + 1).reduce((a, q) => a + q.w + gap, 0);
    return { ...p, x: stopX - used + gap };
  });
  const clipX = stopX - stack - clipW - 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full max-w-md" preserveAspectRatio="xMinYMid meet" aria-hidden>
      {/* manga y barra */}
      <rect x={2} y={cy - 7} width={stopX - 2} height={14} rx={3} fill="#a1a1aa" />
      <rect x={stopX} y={cy - 13} width={stopW} height={26} rx={2} fill="#71717a" />
      <rect x={stopX + stopW} y={cy - 4} width={shaft} height={8} rx={2} fill="#a1a1aa" />
      {rects.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={cy - p.h / 2} width={p.w} height={p.h} rx={2.5} fill={p.color} />
          <rect x={p.x} y={cy - p.h / 2} width={p.w} height={p.h} rx={2.5} fill="none" stroke="#000" strokeOpacity={0.25} />
          {p.w >= 9 && (
            <text
              x={p.x + p.w / 2}
              y={cy}
              fill={p.dark ? "#18181b" : "#fff"}
              fontSize={p.w >= 15 ? 10 : 8}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(-90 ${p.x + p.w / 2} ${cy})`}
            >
              {String(p.kg).replace(".", ",")}
            </text>
          )}
        </g>
      ))}
      {/* cierre */}
      <rect x={clipX} y={cy - 11} width={clipW} height={22} rx={2} fill="#3f3f46" />
      <rect x={clipX + 1.5} y={cy - 16} width={3} height={6} rx={1} fill="#3f3f46" />
    </svg>
  );
}
