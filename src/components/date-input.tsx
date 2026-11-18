"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/**
 * Campo de fecha que siempre se lee en formato europeo (lun, 16 nov 2026),
 * aunque el navegador o el sistema estén en inglés de EE. UU.
 * Debajo hay un <input type="date"> invisible: el valor que se envía sigue siendo AAAA-MM-DD.
 */
export function DateInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  required,
  className = "",
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  required?: boolean;
  className?: string;
}) {
  const { locale } = useI18n();
  const [inner, setInner] = useState(defaultValue ?? "");
  const v = value ?? inner;
  const label = v
    ? new Date(v + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "dd/mm/aaaa";
  return (
    <div className={`relative ${className}`}>
      {/* Lo que se ve: la fecha en formato europeo */}
      <div className="input flex w-full items-center justify-between gap-2 text-left" aria-hidden>
        <span className={v ? "" : "text-muted"}>{label}</span>
        <span>📅</span>
      </div>
      {/* Encima, transparente, el selector nativo: al tocarlo se abre el calendario del móvil (iPhone y Android) */}
      <input
        id={id}
        name={name}
        type="date"
        required={required}
        value={v}
        aria-label={label}
        onChange={(e) => {
          setInner(e.target.value);
          onChange?.(e.target.value);
        }}
        onClick={(e) => {
          // En escritorio, abrir el calendario aunque se pulse fuera del icono
          try {
            e.currentTarget.showPicker();
          } catch {
            /* navegadores sin showPicker: ya se abre solo al tocar */
          }
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        style={{ colorScheme: "dark" }}
      />
    </div>
  );
}
