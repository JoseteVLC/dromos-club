"use client";

import { useState, useTransition } from "react";
import { getAiTip, getWarmup } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";
import { WodTimer } from "@/components/wod-timer";
import type { Wod } from "@/lib/types";

type Panel = "warm" | "tip" | null;
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
}: {
  wod: Pick<Wod, "id" | "title" | "description" | "score_type" | "time_cap_seconds">;
  initialTip: string | null;
}) {
  const { t } = useI18n();
  const [panel, setPanel] = useState<Panel>(null);
  const [timer, setTimer] = useState(false);
  const warm = useLazyText(wod.id, getWarmup);
  const tip = useLazyText(wod.id, getAiTip, initialTip);

  const toggle = (p: Exclude<Panel, null>, src: typeof warm) => {
    if (panel === p) return setPanel(null);
    src.load(() => setPanel(p));
  };

  const btn = (on: boolean) =>
    `btn-ghost flex-1 px-2 py-2 text-xs leading-tight ${on ? "border-accent text-accent" : ""}`;

  const shown = panel === "warm" ? warm : panel === "tip" ? tip : null;
  const error = warm.error ?? tip.error;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" disabled={warm.pending} onClick={() => toggle("warm", warm)} className={btn(panel === "warm")}>
          {warm.pending ? t("Preparando…") : `🔥 ${t("Calentamiento")}`}
        </button>
        <button type="button" onClick={() => setTimer(true)} className={btn(false)}>
          ⏱️ {t("Timer")}
        </button>
        <button type="button" disabled={tip.pending} onClick={() => toggle("tip", tip)} className={btn(panel === "tip")}>
          {tip.pending ? t("Calculando…") : `💡 ${t("Peso y escalado")}`}
        </button>
      </div>

      {error && !shown && <p className="text-center text-xs text-red-400">{t(error)}</p>}

      {shown?.body && (
        <div className="card space-y-2 border-accent/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-accent">
              {panel === "warm" ? `🔥 ${t("Calentamiento para este WOD")}` : `💡 ${t("Peso y escalado para ti")}`}
            </p>
            <button type="button" onClick={() => setPanel(null)} className="text-xs text-muted" aria-label={t("Cerrar")}>✕</button>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{shown.body}</p>
          <p className="text-[11px] text-muted">
            {panel === "warm"
              ? t("Después del calentamiento general. Ajusta los pesos a cómo te encuentres hoy.")
              : t("Calculado con tus marcas. Si algo no te cuadra, pregunta a tu coach.")}
          </p>
        </div>
      )}

      <WodTimer wod={wod} open={timer} onOpenChange={setTimer} />
    </div>
  );
}
