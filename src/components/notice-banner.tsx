"use client";

import Link from "next/link";
import { useNoticesCleared } from "./notice-seen";
import { useI18n } from "@/lib/i18n/client";
import { Icon } from "@/components/icon";

/** Cartel al entrar en la app cuando hay avisos sin leer (no sale en la propia página de Avisos). */
export function NoticeBanner({
  count,
  latest,
  names,
  hasComments,
  medals = 0,
}: {
  count: number;
  latest: string | null;
  names: string[];
  hasComments: boolean;
  medals?: number;
}) {
  const hidden = useNoticesCleared(latest);
  const { t } = useI18n();
  if (!count || hidden) return null;
  if (medals > 0 && names.length === 0)
    return (
      <Link href="/avisos" className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2.5 text-sm">
        <Icon name="medal" size={20} />
        <span className="flex-1">
          <b>{medals === 1 ? t("¡Has desbloqueado una medalla!") : t("¡Has desbloqueado {n} medallas!", { n: medals })}</b>
        </span>
        <span className="font-semibold text-accent">{t("Ver")} →</span>
      </Link>
    );
  const who =
    names.length === 0
      ? t("Alguien")
      : names.length === 1
        ? names[0]
        : names.length === 2
          ? t("{a} y {b}", { a: names[0], b: names[1] })
          : t("{a} y {n} más", { a: names[0], n: names.length - 1 });
  return (
    <Link href="/avisos" className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2.5 text-sm">
      <Icon name={hasComments ? "comment" : "flame"} size={20} />
      <span className="flex-1">
        <b>{who}</b>{" "}
        {hasComments ? t("han comentado o reaccionado a tus resultados") : t("han reaccionado a tus resultados")}
      </span>
      <span className="font-semibold text-accent">{t("Ver")} →</span>
    </Link>
  );
}
