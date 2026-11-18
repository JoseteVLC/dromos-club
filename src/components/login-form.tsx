"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { FormMessage, SubmitButton } from "./ui";
import { useI18n } from "@/lib/i18n/client";

export function LoginForm({ next = "" }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  const { t } = useI18n();
  return (
    <div className="card space-y-4 p-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("Contraseña")}</label>
          <input id="password" name="password" type="password" minLength={6} className="input" autoComplete="current-password" required />
        </div>
        <FormMessage state={state} />
        <SubmitButton className="w-full">{t("Entrar")}</SubmitButton>
      </form>
      <p className="text-center text-xs text-muted">
        {t("El acceso es por invitación de tu box. Si tu box usa {app} y aún no tienes cuenta, pídesela a tu coach.")}
      </p>
    </div>
  );
}
