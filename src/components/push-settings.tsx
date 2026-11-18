"use client";

import { useEffect, useState, useTransition } from "react";
import { deletePushSubscription, savePushSubscription, sendTestPush, updateNotifyPrefs } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";

// Clave pública VAPID (no es secreta; la privada está solo en Vercel)
const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BKsMIOjeT5-Y5CJaprXtor1mdsSbICz_kp9aW0YqqZg8h8t8oMDy5iQJ4kM-E-YtYVZamacJouUIdnYT_PLCmDA";

function b64ToU8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isIOS() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}
export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

type Prefs = { notify_social: boolean; notify_medals: boolean; notify_messages: boolean; notify_reminders: boolean };

export function PushSettings({ prefs }: { prefs: Prefs }) {
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "unsupported" | "ios-install" | "denied" | "off" | "on">("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!pushSupported()) return setState(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  function enable() {
    setMsg(null);
    start(async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(KEY) }));
        const r = await savePushSubscription(sub.toJSON() as never, navigator.userAgent);
        if (r?.error) return setMsg(t(r.error));
        setState("on");
        await sendTestPush();
      } catch {
        setMsg(t("No se han podido activar los avisos en este dispositivo."));
      }
    });
  }

  function disable() {
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  const toggles: { key: keyof Prefs; label: string; hint: string }[] = [
    { key: "notify_social", label: t("Comentarios y reacciones"), hint: t("Cuando alguien comenta o reacciona a tu resultado") },
    { key: "notify_medals", label: t("Medallas"), hint: t("Cuando desbloqueas una medalla") },
    { key: "notify_messages", label: t("Mensajes del equipo"), hint: t("Mensajes de los coaches y anuncios") },
    { key: "notify_reminders", label: t("Recordatorios de entreno"), hint: t("Si tu racha está en peligro o llevas días sin entrenar") },
  ];

  return (
    <section id="avisos" className="card space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="h-display text-xl">🔔 {t("Notificaciones")}</h2>
        {state === "on" && <span className="text-xs font-semibold text-accent">● {t("Activadas en este móvil")}</span>}
      </div>

      {state === "ios-install" && (
        <div className="rounded-lg border border-accent/50 bg-accent/10 p-3 text-sm">
          <b>{t("Para recibir avisos en iPhone, instala la app:")}</b>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>{t("Abre esta web en Safari.")}</li>
            <li>{t("Toca Compartir (el cuadrado con la flecha) → «Añadir a pantalla de inicio».")}</li>
            <li>{t("Abre {app} desde el icono y vuelve aquí para activarlos.")}</li>
          </ol>
        </div>
      )}
      {state === "unsupported" && <p className="text-sm text-muted">{t("Este navegador no permite notificaciones. Prueba con Chrome en Android o instalando la app en iPhone.")}</p>}
      {state === "denied" && (
        <p className="text-sm text-muted">{t("Has bloqueado las notificaciones. Actívalas en los ajustes del móvil para {app} y vuelve a entrar.")}</p>
      )}
      {state === "off" && (
        <button onClick={enable} disabled={busy} className="btn w-full">
          {busy ? t("Activando…") : t("Activar avisos en este móvil")}
        </button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => start(async () => setMsg((await sendTestPush()).ok ? t("Te hemos enviado un aviso de prueba.") : t("No se ha podido enviar la prueba.")))} disabled={busy} className="chip">
            {t("Enviar prueba")}
          </button>
          <button onClick={disable} disabled={busy} className="chip">
            {t("Desactivar en este móvil")}
          </button>
        </div>
      )}
      {msg && <p className="text-sm text-muted">{msg}</p>}

      <div className="divide-y divide-line border-t border-line">
        {toggles.map((x) => (
          <form key={x.key} action={updateNotifyPrefs} className="flex items-center justify-between gap-3 py-3">
            <input type="hidden" name="key" value={x.key} />
            <input type="hidden" name="on" value={prefs[x.key] ? "0" : "1"} />
            <div>
              <div className="text-sm font-semibold">{x.label}</div>
              <div className="text-xs text-muted">{x.hint}</div>
            </div>
            <button
              aria-label={x.label}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${prefs[x.key] ? "bg-accent" : "bg-line"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${prefs[x.key] ? "left-6" : "left-1"}`} />
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
