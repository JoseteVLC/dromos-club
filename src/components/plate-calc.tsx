"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/** Discos de un box (kg) y sus colores de competición. */
const PLATES: { kg: number; color: string; h: number }[] = [
  { kg: 25, color: "#d62828", h: 64 },
  { kg: 20, color: "#1d4ed8", h: 64 },
  { kg: 15, color: "#eab308", h: 58 },
  { kg: 10, color: "#16a34a", h: 52 },
  { kg: 5, color: "#e5e7eb", h: 42 },
  { kg: 2.5, color: "#d62828", h: 34 },
  { kg: 1.25, color: "#9ca3af", h: 28 },
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
export function PlateCalc({ oneRM, lifts }: { oneRM?: number | null; lifts?: { name: string; oneRM: number }[] }) {
  const { t, locale } = useI18n();
  const [rmIdx, setRmIdx] = useState(0);
  const base = lifts?.length ? lifts[rmIdx]?.oneRM ?? null : oneRM ?? null;
  const [pct, setPct] = useState<number | null>(base ? 75 : null);
  const [manual, setManual] = useState<string>("");
  const [bar, setBar] = useState(20);

  const round25 = (kg: number) => Math.round(kg / 2.5) * 2.5;
  const fromPct = base && pct ? round25((base * pct) / 100) : null;
  const typed = Number(manual.replace(",", "."));
  const target = manual && Number.isFinite(typed) && typed > 0 ? typed : fromPct;
  const res = target != null ? platesFor(target, bar) : null;

  return (
    <div className="card space-y-4 p-4">
      {lifts && lifts.length > 0 && (
        <label className="block">
          <span className="label">{t("Movimiento")}</span>
          <select
            className="input"
            value={rmIdx}
            onChange={(e) => {
              setRmIdx(Number(e.target.value));
              setManual("");
            }}
          >
            {lifts.map((l, i) => (
              <option key={l.name} value={i}>
                {l.name} · 1RM {fmt(l.oneRM, locale)} kg
              </option>
            ))}
          </select>
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
          <span className="label">{base ? t("O escribe el peso") : t("Peso total")}</span>
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
              <div className="flex h-20 items-center gap-0.5" aria-hidden>
                <div className="h-3 w-6 rounded-l bg-muted/50" />
                <div className="h-6 w-2 bg-muted/70" />
                {res.plates.map((kg, i) => {
                  const p = PLATES.find((x) => x.kg === kg)!;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-center rounded-sm text-[10px] font-bold"
                      style={{ background: p.color, height: p.h, width: kg >= 10 ? 18 : 12, color: kg === 5 || kg === 15 ? "#111" : "#fff" }}
                    />
                  );
                })}
                <div className="h-3 flex-1 rounded-r bg-muted/50" />
              </div>
              <p className="text-sm">
                <span className="text-muted">{t("Por lado")}:</span> <b className="tabular-nums">{res.plates.map((k) => fmt(k, locale)).join(" + ")}</b>
              </p>
            </>
          )}
          {res.rest > 0 && target >= bar && <p className="text-xs text-muted">{t("Con discos no se llega exacto: faltan {kg} kg.", { kg: fmt(res.rest, locale) })}</p>}
        </div>
      )}
    </div>
  );
}
