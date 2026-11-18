"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button type="submit" disabled={pending} className={`btn ${className}`}>
      {pending ? t("Guardando…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  const { t } = useI18n();
  if (!state) return null;
  // Los mensajes del servidor vienen en español y se traducen aquí
  const vars = state.vars ? Object.fromEntries(Object.entries(state.vars).map(([k, v]) => [k, typeof v === "string" ? t(v) : v])) : undefined;
  if (state.error)
    return <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{t(state.error, vars)}</p>;
  if (state.ok)
    return <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{t(state.ok, vars)}</p>;
  return null;
}

/** Selector segmentado (radios con estilo de botones). */
export function Segmented<T extends string>({
  name,
  options,
  defaultValue,
  onChange,
}: {
  name: string;
  options: { value: T; label: string }[];
  defaultValue?: T;
  onChange?: (v: T) => void;
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-line bg-bg p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={o.value === defaultValue}
            onChange={() => onChange?.(o.value)}
            className="peer sr-only"
          />
          <span className="block rounded-md py-2 text-center font-display text-lg font-bold uppercase text-muted transition peer-checked:bg-accent peer-checked:text-accent-fg">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Botón de borrar en dos toques: el primero pide confirmación, el segundo envía el formulario. */
export function ConfirmDelete({ label = "✕", confirmLabel, className = "" }: { label?: string; confirmLabel?: string; className?: string }) {
  const { t } = useI18n();
  confirmLabel ??= t("¿Borrar?");
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type={armed ? "submit" : "button"}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      disabled={pending}
      className={`${armed ? "rounded bg-red-500/20 px-2 text-xs font-semibold text-red-300" : "px-1 text-muted hover:text-red-400"} ${className}`}
      aria-label={t("Borrar")}
    >
      {pending ? "…" : armed ? confirmLabel : label}
    </button>
  );
}
