"use client";

import { useState, useTransition } from "react";
import { getAiTip, getWarmup } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";
import { WodTimer } from "@/components/wod-timer";
import { PlateCalc } from "@/components/plate-calc";
import type { Lift } from "@/lib/lifts";
import type { Wod } from "@/lib/types";
import { Icon } from "@/components/icon";

type Panel = "warm" | "tip" | "calc" | null;
type Fetcher = (wodId: string) => Promise<{ body?: string | null; error?: string | null }>;

/** Texto que se pide una vez y se guarda (calentamiento o peso y escalado). */
function useLazyText(wodId: string, fetcher: Fetcher, initial: string | null = null) {
  const [body, setBody] = useState<string | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const load = (onReady: () => void) => {
    if (body) return onReady();
    setError(null);
    start(async () => {
      const r = await fetcher(wodId);
      if (r.body) {
        setBody(r.body);
        onReady();
      } else setError(r.error ?? null);
    });
  };
  return { body, error, pending, load };
}

/** Fila con 🔥 Calentamiento · ⏱️ Timer · 💡 Peso y escalado; el panel elegido se abre debajo. */
export function WodTools({
  wod,
  initialTip,
  calc,
}: {
  wod: Pick<Wod, "id" | "title" | "description" | "score_type" | "time_cap_seconds">;
  initialTip: string | null;
  /** Solo en WODs con pesos: tus RM y el movimiento y % que pide el WOD */
  calc?: { lifts: Lift[]; initialLift?: number; initialPct?: number } | null;
}) {
  const { t } = useI18n();
  const [panel, setPanel] = useState<Panel>(null);
  const [timer, setTimer] = useState(false);
  const warm = useLazyText(wod.id, getWarmup);
  const tip = useLazyText(wod.id, getAiTip, initialTip);

  const toggle = (p: Exclude<Panel, null | "calc">, src: typeof warm) => {
    if (panel === p) return setPanel(null);
    src.load(() => setPanel(p));
  };

  const btn = (on: boolean) =>
    `btn-ghost inline-flex flex-1 items-center justify-center gap-1 px-2 py-2 text-xs leading-tight ${on ? "border-accent text-accent" : ""}`;

  const shown = panel === "warm" ? warm : panel === "tip" ? tip : null;
  // Técnica, skills o calentamiento: el consejo son ideas de ejercicios y no hace falta otro calentamiento
  const skill = wod.score_type === "check";
  const error = warm.error ?? tip.error;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {!skill && <button type="button" disabled={warm.pending} onClick={() => toggle("warm", warm)} className={btn(panel === "warm")}>
          {warm.pending ? t("Preparando…") : <><Icon name="flame" size={15} /> {t("Calentamiento")}</>}
        </button>}
        <button type="button" onClick={() => setTimer(true)} className={btn(false)}>
          <Icon name="timer" size={15} /> {t("Timer")}
        </button>
        <button type="button" disabled={tip.pending} onClick={() => toggle("tip", tip)} className={btn(panel === "tip")}>
          {tip.pending ? t("Calculando…") : <><Icon name="tip" size={15} /> {skill ? t("Ideas") : t("Peso y escalado")}</>}
        </button>
        {calc && (
          <button type="button" onClick={() => setPanel(panel === "calc" ? null : "calc")} className={`${btn(panel === "calc")} inline-flex items-center justify-center gap-1`}>
            <Icon name="plates" size={15} /> {t("Discos")}
          </button>
        )}
      </div>

      {error && !shown && <p className="text-center text-xs text-red-400">{t(error)}</p>}

      {shown?.body && (
        <div className="card space-y-2 border-accent/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent">
              {panel === "warm" ? <><Icon name="flame" /> {t("Calentamiento para este WOD")}</> : <><Icon name="tip" /> {skill ? t("Ideas para este bloque") : t("Peso y escalado para ti")}</>}
            </p>
            <button type="button" onClick={() => setPanel(null)} className="text-xs text-muted" aria-label={t("Cerrar")}>✕</button>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{shown.body}</p>
          <p className="text-[11px] text-muted">
            {panel === "warm"
              ? t("Después del calentamiento general. Ajusta los pesos a cómo te encuentres hoy.")
              : skill
                ? t("Elige las que encajen con tu nivel. Si tienes dudas, pregunta a tu coach.")
                : t("Calculado con tus marcas. Si algo no te cuadra, pregunta a tu coach.")}
          </p>
        </div>
      )}

      {panel === "calc" && calc && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent"><Icon name="plates" size={16} /> {t("Calculadora de % y discos")}</p>
            <button type="button" onClick={() => setPanel(null)} className="text-xs text-muted" aria-label={t("Cerrar")}>✕</button>
          </div>
          <PlateCalc lifts={calc.lifts} initialLift={calc.initialLift} initialPct={calc.initialPct} />
        </div>
      )}

      <WodTimer wod={wod} open={timer} onOpenChange={setTimer} />
    </div>
  );
}
