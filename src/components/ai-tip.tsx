"use client";

import { useState, useTransition } from "react";
import { getAiTip } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";

/** Botón «Peso y escalado para ti»: la IA mira el WOD y tus marcas. */
export function AiTip({ wodId, initial }: { wodId: string; initial: string | null }) {
  const { t } = useI18n();
  const [body, setBody] = useState<string | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!!initial);
  const [pending, start] = useTransition();

  if (open && body)
    return (
      <div className="card space-y-2 border-accent/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-accent">💡 {t("Peso y escalado para ti")}</p>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted" aria-label={t("Cerrar")}>✕</button>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed">{body}</p>
        <p className="text-[11px] text-muted">{t("Calculado con tus marcas. Si algo no te cuadra, pregunta a tu coach.")}</p>
      </div>
    );

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (body) return setOpen(true);
          setError(null);
          start(async () => {
            const r = await getAiTip(wodId);
            if (r.body) {
              setBody(r.body);
              setOpen(true);
            } else setError(r.error ?? null);
          });
        }}
        className="btn-ghost w-full py-3 text-sm"
      >
        {pending ? t("Calculando…") : `💡 ${t("Peso y escalado para ti")}`}
      </button>
      {error && <p className="text-center text-xs text-alert">{t(error)}</p>}
    </div>
  );
}
