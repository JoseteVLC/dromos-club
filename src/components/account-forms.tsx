"use client";

import { DateInput } from "./date-input";
import { useActionState } from "react";
import { acceptInvitation, updatePassword, updateProfile } from "@/app/actions";
import { DIVISIONS, type Division, type Gender, type Profile } from "@/lib/types";
import { FormMessage, Segmented, SubmitButton } from "./ui";
import { useI18n } from "@/lib/i18n/client";

export const GENDER_OPTS = [
  { value: "M" as Gender, label: "Chico" },
  { value: "F" as Gender, label: "Chica" },
];

export function AcceptInviteForm({ token, email, firstName, lastName }: { token: string; email: string; firstName: string; lastName: string }) {
  const [state, action] = useActionState(acceptInvitation, undefined);
  const { t } = useI18n();
  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="token" value={token} />
      <div>
        <span className="label">Email</span>
        <p className="input bg-card text-muted">{email}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="first_name">{t("Nombre")}</label>
          <input id="first_name" name="first_name" className="input" defaultValue={firstName} autoComplete="given-name" required />
        </div>
        <div>
          <label className="label" htmlFor="last_name">{t("Apellidos")}</label>
          <input id="last_name" name="last_name" className="input" defaultValue={lastName} autoComplete="family-name" />
        </div>
      </div>
      <div>
        <span className="label">{t("Categoría")}</span>
        <Segmented<Gender> name="gender" options={GENDER_OPTS.map((o) => ({ ...o, label: t(o.label) }))} />
      </div>
      <div>
        <label className="label" htmlFor="password">{t("Crea tu contraseña")}</label>
        <input id="password" name="password" type="password" minLength={6} className="input" autoComplete="new-password" required />
      </div>
      <div>
        <label className="label" htmlFor="password2">{t("Repítela")}</label>
        <input id="password2" name="password2" type="password" minLength={6} className="input" autoComplete="new-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full">{t("Crear cuenta y entrar")}</SubmitButton>
    </form>
  );
}

export function PersonalForm({ profile }: { profile: Profile | null }) {
  const [state, action] = useActionState(updateProfile, undefined);
  const { t } = useI18n();
  return (
    <form action={action} className="card space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="first_name">{t("Nombre")}</label>
          <input id="first_name" name="first_name" className="input" defaultValue={profile?.first_name || profile?.full_name || ""} required />
        </div>
        <div>
          <label className="label" htmlFor="last_name">{t("Apellidos")}</label>
          <input id="last_name" name="last_name" className="input" defaultValue={profile?.last_name ?? ""} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted">{t("Así sales en el leaderboard.")}</p>
      <div>
        <span className="label">{t("Categoría")}</span>
        <Segmented<Gender> name="gender" options={GENDER_OPTS.map((o) => ({ ...o, label: t(o.label) }))} defaultValue={profile?.gender ?? undefined} />
      </div>
      <div>
        <span className="label">{t("Nivel habitual (se marca solo al meter resultados)")}</span>
        <Segmented<Division> name="division" options={DIVISIONS.map((d) => ({ ...d, label: t(d.label) }))} defaultValue={profile?.division ?? undefined} />
      </div>
      <div>
        <label className="label" htmlFor="bio">{t("Sobre ti (público)")}</label>
        <textarea id="bio" name="bio" rows={2} maxLength={200} className="input" defaultValue={profile?.bio ?? ""} placeholder={t("Ej.: Entreno a las 7:00, loco de los WODs largos…")} />
      </div>
      <div>
        <label className="label" htmlFor="instagram">Instagram ({t("público")})</label>
        <input id="instagram" name="instagram" className="input" defaultValue={profile?.instagram ? `@${profile.instagram}` : ""} placeholder="@usuario" autoCapitalize="none" />
      </div>

      <fieldset className="space-y-4 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-semibold">🔒 {t("Datos privados")}</legend>
        <p className="-mt-1 text-xs text-muted">{t("Solo los ve el equipo de tu box (para enviarte algún regalo, premios de medallas, rankings por edad…). Ningún atleta puede verlos.")}</p>
        <div>
          <label className="label" htmlFor="box">{t("¿En qué box entrenas?")}</label>
          <input id="box" name="box" className="input" maxLength={80} defaultValue={profile?.box ?? ""} placeholder={t("Nombre del box y ciudad")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="phone">{t("Teléfono")}</label>
            <input id="phone" name="phone" type="tel" className="input" defaultValue={profile?.phone ?? ""} autoComplete="tel" />
          </div>
          <div>
            <label className="label" htmlFor="birth_date">{t("Nacimiento")}</label>
            <DateInput id="birth_date" name="birth_date" defaultValue={profile?.birth_date ?? ""} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="address_line">{t("Dirección")}</label>
          <input id="address_line" name="address_line" className="input" maxLength={200} defaultValue={profile?.address_line ?? ""} autoComplete="street-address" placeholder={t("Calle, número, piso")} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="postal_code">{t("C. postal")}</label>
            <input id="postal_code" name="postal_code" className="input" maxLength={12} defaultValue={profile?.postal_code ?? ""} autoComplete="postal-code" />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="city">{t("Ciudad")}</label>
            <input id="city" name="city" className="input" maxLength={80} defaultValue={profile?.city ?? ""} autoComplete="address-level2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="country">{t("País")}</label>
            <input id="country" name="country" className="input" maxLength={60} defaultValue={profile?.country ?? ""} autoComplete="country-name" />
          </div>
          <div>
            <label className="label" htmlFor="shirt_size">{t("Talla de camiseta")}</label>
            <select id="shirt_size" name="shirt_size" className="input" defaultValue={profile?.shirt_size ?? ""}>
              <option value="">—</option>
              {["XS", "S", "M", "L", "XL", "XXL"].map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-xs text-muted">{t("Si quieres, puedes enseñar esto en tu perfil público:")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="show_box" defaultChecked={!!profile?.show_box} className="h-4 w-4 accent-[var(--color-accent)]" />
            {t("Mostrar mi box")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="show_age" defaultChecked={!!profile?.show_age} className="h-4 w-4 accent-[var(--color-accent)]" />
            {t("Mostrar mi edad (no la fecha)")}
          </label>
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="w-full">{t("Guardar datos")}</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  const { t } = useI18n();
  return (
    <form action={action} className="card space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="np">{t("Nueva contraseña")}</label>
          <input id="np" name="password" type="password" minLength={6} className="input" autoComplete="new-password" required />
        </div>
        <div>
          <label className="label" htmlFor="np2">{t("Repítela")}</label>
          <input id="np2" name="password2" type="password" minLength={6} className="input" autoComplete="new-password" required />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full">{t("Cambiar contraseña")}</SubmitButton>
    </form>
  );
}
