"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { Icon, type IconName } from "@/components/icon";

/** Icono de cada pestaña: a color cuando está activa, en gris cuando no */
const ICONS = { hoy: "wod", dia: "list", feed: "activity", ranking: "trophy", historial: "chart", coach: "clipboard", perfil: "user" } as const satisfies Record<string, IconName>;

export function BottomNav({ isCoach, competition = false }: { isCoach: boolean; competition?: boolean }) {
  const path = usePathname();
  const { t } = useI18n();
  const items: { href: string; key: keyof typeof ICONS; label: string; active: boolean }[] = [
    { href: "/", key: "hoy", label: t("WODs"), active: path === "/" || path.startsWith("/d/") },
    { href: "/dia", key: "dia", label: t("Día"), active: path.startsWith("/dia") },
    { href: "/feed", key: "feed", label: t("Feed"), active: path.startsWith("/feed") },
    ...(competition ? [] : [{ href: "/ranking", key: "ranking" as const, label: t("Ranking"), active: path.startsWith("/ranking") || path.startsWith("/medallas") }]),
    { href: "/historial", key: "historial", label: t("Historial"), active: path.startsWith("/historial") || path.startsWith("/marcas") },
    ...(isCoach ? [{ href: "/coach", key: "coach" as const, label: t("Coach"), active: path.startsWith("/coach") }] : []),
    { href: "/perfil", key: "perfil", label: t("Perfil"), active: path.startsWith("/perfil") },
  ];

  return (
    // Fondo sólido y capa propia: en iPhone el desenfoque (backdrop-blur) hacía que el menú se quedara a media pantalla al hacer scroll
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]"
      style={{ transform: "translate3d(0,0,0)", WebkitBackfaceVisibility: "hidden", willChange: "transform" }}
    >
      <div className="mx-auto flex max-w-2xl">
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-2 font-semibold uppercase ${items.length > 6 ? "text-[9.5px] tracking-normal" : "text-[11px] tracking-wide"} ${
              it.active ? "text-accent" : "text-muted"
            }`}
          >
            {it.active ? <Icon name={ICONS[it.key]} size={24} /> : <Icon name={ICONS[it.key]} size={24} mono />}
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
