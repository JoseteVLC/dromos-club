"use client";

import { useActionState, useState } from "react";
import { createBox } from "@/app/actions";
import { FormMessage } from "./ui";
import { useI18n } from "@/lib/i18n/client";
import { isValidSlug, slugify } from "@/lib/box-shared";

export function NewBoxForm({ loggedIn }: { loggedIn: boolean }) {
  const [state, action, pending] = useActionState(createBox, undefined);
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const shown = touched ? slug : slugify(name);
  const ok = isValidSlug(shown);

  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="box_name">{t("Nombre del box")}</label>
        <input id="box_name" name="box_name" required minLength={2} maxLength={60} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="CrossFit Valencia" />
      </div>
      <div>
        <label className="label" htmlFor="slug">{t("Dirección del box")}</label>
        <div className="flex items-center rounded-lg border border-line bg-bg focus-within:border-accent">
          <span className="pl-3 text-sm text-muted">/</span>
          <input
            id="slug"
            name="slug"
            required
            className="w-full bg-transparent px-1 py-2.5 text-fg outline-none"
            value={shown}
            onChange={(e) => {
              setTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            aria-describedby="slug-help"
          />
        </div>
        <p id="slug-help" className={`mt-1 text-xs ${shown && !ok ? "text-alert" : "text-muted"}`}>
          {shown && !ok ? t("Entre 3 y 30 letras minúsculas, números o guiones.") : t("Será la dirección de tu box (luego, tubox.dromosclub.com).")}
        </p>
      </div>

      {!loggedIn && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="first_name">{t("Tu nombre")}</label>
              <input id="first_name" name="first_name" required className="input" autoComplete="given-name" />
            </div>
            <div>
              <label className="label" htmlFor="last_name">{t("Apellidos")}</label>
              <input id="last_name" name="last_name" className="input" autoComplete="family-name" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">{t("Crea tu contraseña")}</label>
            <input id="password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" />
          </div>
        </>
      )}

      <button disabled={pending || !ok} className="btn w-full">{pending ? "…" : t("Crear mi box")}</button>
      {state?.error && <FormMessage state={state} />}
      <p className="text-center text-xs text-muted">{t("Serás el admin del box. Puedes invitar a otros coaches desde Admin.")}</p>
    </form>
  );
}
