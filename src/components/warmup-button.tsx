"use client";

import { useState, useTransition } from "react";
import { getWarmup } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";

/** «🔥 Calentamiento»: unos minutos específicos para este WOD, después del calentamiento general. */
export function WarmupButton({ wodId }: { wodId: string }) {
  const { t } = useI18n();
  const [body, setBody] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (open && body)
    return (
      <div className="card space-y-2 border-accent/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-accent">🔥 {t("Calentamiento para este WOD")}</p>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted" aria-label={t("Cerrar")}>✕</button>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed">{body}</p>
        <p className="text-[11px] text-muted">{t("Después del calentamiento general. Ajusta los pesos a cómo te encuentres hoy.")}</p>
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
            const r = await getWarmup(wodId);
            if (r.body) {
              setBody(r.body);
              setOpen(true);
            } else setError(r.error ?? null);
          });
        }}
        className="btn-ghost w-full py-3 text-sm"
      >
        {pending ? t("Preparando…") : `🔥 ${t("Calentamiento")}`}
      </button>
      {error && <p className="text-center text-xs text-alert">{t(error)}</p>}
    </div>
  );
}
