"use client";

import Link from "next/link";
import { useActionState } from "react";
import { joinBox } from "@/app/actions";
import { FormMessage, Segmented } from "./ui";
import { GENDER_OPTS } from "./account-forms";
import type { Gender } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";

export function JoinBoxForm({ code, loggedIn, boxName, approval }: { code: string; loggedIn: boolean; boxName: string; approval: boolean }) {
  const [state, action, pending] = useActionState(joinBox, undefined);
  const { t } = useI18n();
  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="code" value={code} />
      {!loggedIn && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="first_name">{t("Nombre")}</label>
              <input id="first_name" name="first_name" required className="input" autoComplete="given-name" />
            </div>
            <div>
              <label className="label" htmlFor="last_name">{t("Apellidos")}</label>
              <input id="last_name" name="last_name" className="input" autoComplete="family-name" />
            </div>
          </div>
          <div>
            <span className="label">{t("Categoría")}</span>
            <Segmented<Gender> name="gender" options={GENDER_OPTS.map((o) => ({ ...o, label: t(o.label) }))} />
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
      <button disabled={pending} className="btn w-full">{pending ? "…" : t("Unirme a {box}", { box: boxName })}</button>
      {state?.error && <FormMessage state={state} />}
      <p className="text-center text-xs text-muted">
        {approval ? t("El box revisará tu solicitud. En cuanto te acepte, podrás entrar con tu email y contraseña.") : t("Entrarás directamente.")}
      </p>
      {!loggedIn && (
        <p className="text-center text-sm">
          <Link href={`/login?next=${encodeURIComponent(`/unirse/${code}`)}` as "/login"} className="text-accent underline">
            {t("Ya tengo cuenta")}
          </Link>
        </p>
      )}
    </form>
  );
}
