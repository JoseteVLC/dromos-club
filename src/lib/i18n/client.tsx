"use client";

import { createContext, useContext, useMemo } from "react";
import { LOCALES, makeT, type Lang } from "./core";

const Ctx = createContext<Lang>("es");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const lang = useContext(Ctx);
  return useMemo(() => ({ lang, t: makeT(lang), locale: LOCALES[lang] }), [lang]);
}
