import en from "./en";
import pl from "./pl";
import fr from "./fr";
import { BRAND } from "../brand";

/** Idiomas de la app. El español es el texto original (la clave); en/fr/pl son traducciones. */
export const LANGS = ["es", "en", "fr", "pl"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { es: "Español", en: "English", fr: "Français", pl: "Polski" };
export const LOCALES: Record<Lang, string> = { es: "es-ES", en: "en-GB", fr: "fr-FR", pl: "pl-PL" };
export const LANG_COOKIE = "lang";

const DICTS: Record<Lang, Record<string, string>> = { es: {}, en, fr, pl };

export type Vars = Record<string, string | number>;
export type T = (text: string, vars?: Vars) => string;

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

/** t("Faltan {n} días", { n: 3 }) → traducido si existe, si no el español. */
export function makeT(lang: Lang): T {
  const dict = DICTS[lang];
  return (text, vars) => {
    let s = (dict[text] ?? text).split("{appLong}").join(BRAND.name).split("{app}").join(BRAND.short);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

/** Idioma preferido según Accept-Language (es/en/fr/pl), por defecto español. */
export function langFromHeader(h: string | null | undefined): Lang {
  for (const part of (h ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return "es";
}
