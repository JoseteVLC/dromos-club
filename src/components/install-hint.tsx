"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Platform = "ios" | "android" | "desktop" | "installed";
const KEY = "install-hint-dismissed";

// El evento de instalación de Android puede llegar antes de que se pinte el componente: lo guardamos aquí
let deferredPrompt: BIPEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
  });
}

function detect(): { platform: Platform; inApp: boolean } {
  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|GSA\//i.test(ua);
  if (standalone) return { platform: "installed", inApp };
  if (/iphone|ipad|ipod/i.test(ua)) return { platform: "ios", inApp };
  if (/android/i.test(ua)) return { platform: "android", inApp };
  return { platform: "desktop", inApp };
}

function useInstall() {
  const [info, setInfo] = useState<{ platform: Platform; inApp: boolean } | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setInfo(detect());
      setCanPrompt(!!deferredPrompt);
    });
    const onPrompt = () => setTimeout(() => setCanPrompt(!!deferredPrompt), 0);
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);
  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    deferredPrompt = null;
    setCanPrompt(false);
  };
  return { info, canPrompt, install };
}

/** Instrucciones según el móvil (iPhone / Android / ordenador). */
function Steps({ platform, inApp, canPrompt, install }: { platform: Platform; inApp: boolean; canPrompt: boolean; install: () => void }) {
  const { t } = useI18n();
  if (platform === "installed") return <p className="text-sm text-emerald-400">✓ {t("Ya la tienes instalada.")}</p>;
  const installBtn = (
    <button type="button" onClick={install} className="btn px-4 py-2">
      {t("Instalar app")}
    </button>
  );
  return (
    <div className="space-y-2 text-sm text-muted">
      {inApp && (
        <p className="rounded-xl bg-accent/10 px-3 py-2 text-fg">
          ⚠️ {t("La tienes abierta dentro de otra app (WhatsApp, Instagram…). Ábrela primero en {browser}: menú ⋯ → «Abrir en el navegador».", { browser: platform === "ios" ? "Safari" : "Chrome" })}
        </p>
      )}
      {platform === "ios" && (
        <ol className="list-decimal space-y-1 pl-5">
          <li>{t("En Safari, pulsa ⋯ (abajo a la derecha) o el botón Compartir (el cuadrado con la flecha ⬆️).")}</li>
          <li>{t("Pulsa Compartir si hace falta y baja hasta «Añadir a pantalla de inicio».")}</li>
          <li>{t("Pulsa Añadir. Te aparecerá el icono TC en el móvil.")}</li>
        </ol>
      )}
      {platform === "android" &&
        (canPrompt ? installBtn : <p>{t("En Chrome, pulsa el menú ⋮ (arriba a la derecha) → «Instalar aplicación» o «Añadir a pantalla de inicio».")}</p>)}
      {platform === "desktop" &&
        (canPrompt ? installBtn : <p>{t("Ábrela en el móvil para instalarla, o en Chrome/Edge usa el icono de instalar de la barra de direcciones.")}</p>)}
    </div>
  );
}

/** Aviso en el inicio (solo organizadores, se puede cerrar). */
export function InstallHint() {
  const { t } = useI18n();
  const { info, canPrompt, install } = useInstall();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        setDismissed(localStorage.getItem(KEY) === "1");
      } catch {
        setDismissed(false);
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (!info || dismissed || info.platform === "installed" || info.platform === "desktop") return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setDismissed(true);
  };
  return (
    <div className="card flex items-start gap-3 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="font-semibold">{t("Instala la app en tu móvil")}</div>
        <Steps platform={info.platform} inApp={info.inApp} canPrompt={canPrompt} install={install} />
      </div>
      <button type="button" onClick={close} className="text-muted hover:text-fg" aria-label={t("Cerrar")}>
        ✕
      </button>
    </div>
  );
}

/** Ayuda siempre visible (en el perfil). */
export function InstallHelp() {
  const { info, canPrompt, install } = useInstall();
  if (!info) return null;
  return (
    <div className="card flex items-start gap-3 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="flex-1">
        <Steps platform={info.platform} inApp={info.inApp} canPrompt={canPrompt} install={install} />
      </div>
    </div>
  );
}
