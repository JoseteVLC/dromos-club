"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isIOS, isStandalone, pushSupported } from "./push-settings";
import { useI18n } from "@/lib/i18n/client";
import { Icon } from "@/components/icon";

/** Cartel que invita a instalar la app / activar avisos. Se puede cerrar (vuelve a salir a los 7 días). */
export function PushPrompt() {
  const { t } = useI18n();
  const path = usePathname();
  const [kind, setKind] = useState<null | "install" | "enable">(null);

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem("push-prompt-hide") ?? 0);
      if (Date.now() < until) return;
    } catch {}
    (async () => {
      if (!pushSupported()) {
        if (isIOS() && !isStandalone()) setKind("install");
        return;
      }
      if (Notification.permission !== "default") return;
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (!(await reg.pushManager.getSubscription())) setKind("enable");
    })().catch(() => {});
  }, []);

  if (!kind || path.startsWith("/perfil")) return null;
  const hide = () => {
    try {
      localStorage.setItem("push-prompt-hide", String(Date.now() + 7 * 864e5));
    } catch {}
    setKind(null);
  };
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2.5 text-sm">
      <Icon name="bell" size={22} />
      <Link href="/perfil#avisos" className="flex-1">
        {kind === "install" ? (
          <>
            <b>{t("Instala la app")}</b> {t("para recibir avisos de comentarios, medallas y mensajes.")}
          </>
        ) : (
          <>
            <b>{t("Activa los avisos")}</b> {t("y entérate cuando te comenten o ganes una medalla.")}
          </>
        )}
      </Link>
      <button onClick={hide} aria-label={t("Cerrar")} className="px-1 text-muted">
        ✕
      </button>
    </div>
  );
}
