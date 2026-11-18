"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

const ICONS = {
  hoy: (
    <path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4" />
  ),
  historial: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  ranking: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
  coach: <path d="M12 3v18M3 12h18" />,
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
};

export function BottomNav({ isCoach }: { isCoach: boolean }) {
  const path = usePathname();
  const { t } = useI18n();
  const items: { href: string; key: keyof typeof ICONS; label: string; active: boolean }[] = [
    { href: "/", key: "hoy", label: t("WODs"), active: path === "/" || path.startsWith("/d/") },
    { href: "/ranking", key: "ranking", label: t("Ranking"), active: path.startsWith("/ranking") },
    { href: "/historial", key: "historial", label: t("Historial"), active: path.startsWith("/historial") || path.startsWith("/marcas") },
    ...(isCoach ? [{ href: "/coach", key: "coach" as const, label: t("Coach"), active: path.startsWith("/coach") }] : []),
    { href: "/perfil", key: "perfil", label: t("Perfil"), active: path.startsWith("/perfil") },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold uppercase tracking-wide ${
              it.active ? "text-accent" : "text-muted"
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {ICONS[it.key]}
            </svg>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
