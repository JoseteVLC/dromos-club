"use client";

import { useActionState } from "react";
import { updateBox } from "@/app/actions";
import { FormMessage } from "./ui";
import { useI18n } from "@/lib/i18n/client";

export function BoxSettingsForm({ name, rewards, competition, url }: { name: string; rewards: boolean; competition: boolean; url: string }) {
  const [state, action, pending] = useActionState(updateBox, undefined);
  const { t } = useI18n();
  return (
    <form action={action} className="card space-y-4 p-4">
      <div>
        <label className="label" htmlFor="box_name">{t("Nombre del box")}</label>
        <input id="box_name" name="box_name" defaultValue={name} required minLength={2} maxLength={60} className="input" />
      </div>
      <div className="text-sm">
        <span className="label">{t("Dirección del box")}</span>
        <a href={url} className="break-all text-accent underline">{url}</a>
        <p className="mt-1 text-xs text-muted">{t("Compártela con tus atletas. Para cambiarla, escríbenos.")}</p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="rewards" defaultChecked={rewards} className="mt-1 h-5 w-5 accent-[var(--accent)]" />
        <span>
          <span className="font-semibold">{t("Premios por medallas")}</span>
          <span className="block text-xs text-muted">{t("Imparable, Centurión, Leyenda e Inmortal llevan un premio de tu box. Verás aquí quién lo ha ganado y sus datos de envío.")}</span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="competition" defaultChecked={competition} className="mt-1 h-5 w-5 accent-[var(--accent)]" />
        <span>
          <span className="font-semibold">{t("Modo competición")}</span>
          <span className="block text-xs text-muted">{t("Para equipos de atletas que compiten: sin constancia, medallas, puntos ni ranking, y sin recordatorios de racha. Los atletas solo ven la plani, sus resultados y sus marcas; el equipo tiene la ficha completa de cada uno.")}</span>
        </span>
      </label>
      <button disabled={pending} className="btn">{pending ? "…" : t("Guardar")}</button>
      {state && <FormMessage state={state} />}
    </form>
  );
}
