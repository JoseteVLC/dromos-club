import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, LOCALES, isLang, langFromHeader, makeT, type Lang } from "./core";

export const getLang = cache(async (): Promise<Lang> => {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  return langFromHeader((await headers()).get("accept-language"));
});

export async function getI18n() {
  const lang = await getLang();
  return { lang, t: makeT(lang), locale: LOCALES[lang] };
}
