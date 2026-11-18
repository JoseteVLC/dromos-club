"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createInvitation } from "@/app/actions";
import { FormMessage, Segmented } from "./ui";
import { useI18n } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/core";

export function inviteText(name: string, link: string, t: T) {
  return t("¡Hola {name}! Te invito a probar el leaderboard de {app} 🔥 Entra aquí, crea tu contraseña y empieza a meter tus resultados: {link}", { name, link });
}

export function ShareInvite({ name, email, link }: { name: string; email: string; link: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  const text = inviteText(name, link, t);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className="btn-ghost">
        {copied ? t("✓ Copiado") : t("Copiar enlace")}
      </button>
      <a className="btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <a
        className="btn-ghost"
        href={`mailto:${email}?subject=${encodeURIComponent(t("Tu invitación al leaderboard de {app}"))}&body=${encodeURIComponent(text)}`}
      >
        Email
      </a>
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvitation, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [last, setLast] = useState<{ name: string; email: string; link: string } | null>(null);
  const [error, setError] = useState<{ error: string; vars?: Record<string, string | number> } | null>(null);
  const { t } = useI18n();

  // Cada respuesta nueva del servidor: mostrar la última invitación y vaciar el formulario
  useEffect(() => {
    if (!state) return;
    const id = requestAnimationFrame(() => {
      if (state.error) {
        setError({ error: state.error, vars: state.vars });
        return;
      }
      setError(null);
      if (state.link) {
        setLast({ name: state.name ?? "", email: state.email ?? "", link: state.link });
        formRef.current?.reset();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [state]);

  return (
    <div className="space-y-3">
      <form ref={formRef} action={action} className="card space-y-4 p-4" onChange={() => error && setError(null)}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="inv_first">{t("Nombre")}</label>
            <input id="inv_first" name="first_name" className="input" autoComplete="off" required />
          </div>
          <div>
            <label className="label" htmlFor="inv_last">{t("Apellidos")}</label>
            <input id="inv_last" name="last_name" className="input" autoComplete="off" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="inv_email">Email</label>
          <input id="inv_email" name="email" type="email" className="input" autoComplete="off" required />
        </div>
        <div>
          <span className="label">{t("Rol")}</span>
          <Segmented
            name="role"
            options={[
              { value: "athlete", label: t("Atleta") },
              { value: "coach", label: "Coach" },
            ]}
            defaultValue="athlete"
          />
        </div>
        {error && <FormMessage state={error} />}
        <button type="submit" disabled={pending} className="btn w-full">
          {pending ? t("Creando…") : t("Crear invitación")}
        </button>
      </form>
      {last && !pending && (
        <div key={last.link} className="card space-y-3 border-accent p-4">
          <p className="font-semibold">✓ {t("Invitación para {name} lista", { name: last.name })}</p>
          <p className="break-all rounded-lg bg-bg p-2 font-mono text-xs text-muted">{last.link}</p>
          <p className="text-xs text-muted">{t("Envíasela por WhatsApp o email. Con ese enlace crea su contraseña y entra.")}</p>
          <ShareInvite name={last.name} email={last.email} link={last.link} />
        </div>
      )}
    </div>
  );
}
