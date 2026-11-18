"use client";

import { useTransition } from "react";
import { setLanguage } from "@/app/actions";
import { LANGS, LANG_NAMES } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/client";

/** Selector ES / EN / PL. Se guarda en una cookie (y en el perfil si hay sesión). */
export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang } = useI18n();
  const [pending, start] = useTransition();
  return (
    <div className={`flex gap-2 ${compact ? "justify-center" : ""}`} role="radiogroup" aria-label="Idioma / Language / Język">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          disabled={pending}
          onClick={() => start(() => setLanguage(l))}
          className={`chip ${lang === l ? "chip-on" : ""} ${compact ? "text-xs" : ""}`}
        >
          {compact ? l.toUpperCase() : LANG_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
