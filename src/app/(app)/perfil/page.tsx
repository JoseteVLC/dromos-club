import Link from "next/link";
import { after } from "next/server";
import { syncMedals } from "@/lib/achievements";
import { MEDALS } from "@/lib/medals";
import { MedalBadge } from "@/components/medal-badge";
import { AvatarUpload } from "@/components/avatar-upload";
import { PushSettings } from "@/components/push-settings";
import type { Profile } from "@/lib/types";
import { isCoachProfile, requireUser } from "@/lib/supabase/server";
import { PasswordForm, PersonalForm } from "@/components/account-forms";
import { InstallHelp } from "@/components/install-hint";
import { leaveBox, logout } from "@/app/actions";
import { ConfirmDelete } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { LangSwitcher } from "@/components/lang-switcher";

export default async function PerfilPage({ searchParams }: PageProps<"/perfil">) {
  const sp = await searchParams;
  const { supabase, user, profile, box } = await requireUser();
  const { t } = await getI18n();
  // Teléfono y nacimiento son privados: solo el dueño los lee, mediante una función de la base de datos
  const { data: priv, error: privErr } = await supabase.rpc("my_private_profile").maybeSingle<Partial<Profile>>();
  const fallback = privErr
    ? (await supabase.from("profiles").select("phone, birth_date").eq("id", user.id).maybeSingle<{ phone: string | null; birth_date: string | null }>()).data
    : null;
  const me = profile ? { ...profile, ...(priv ?? fallback ?? {}) } : profile;
  const { data: prefs } = await supabase
    .from("profiles")
    .select("notify_social, notify_medals, notify_messages, notify_reminders, notify_weekly")
    .eq("id", user.id)
    .maybeSingle<{ notify_social: boolean; notify_medals: boolean; notify_messages: boolean; notify_reminders: boolean; notify_weekly: boolean }>();
  const { data: myMedals } = await supabase.from("user_achievements").select("code").eq("user_id", user.id);
  const ownedMedals = new Set((myMedals ?? []).map((m) => m.code as string));
  // Recalcula medallas en segundo plano (por si hay alguna nueva de antes de existir el sistema)
  after(() => syncMedals(supabase, user.id, box).catch(() => {}));
  return (
    <div className="space-y-6">
      <h1 className="h-title text-5xl">{t("Perfil")}</h1>

      {sp.bienvenida && (
        <div className="card space-y-1 border-accent p-4">
          <p className="font-semibold text-accent">{t("¡Bienvenido/a al leaderboard! 🔥")}</p>
          <p className="text-sm text-muted">
            {t("Revisa tus datos, instala la app en el móvil (abajo te explicamos cómo) y ve a WODs para meter tu primer resultado.")}
          </p>
        </div>
      )}

      <PushSettings prefs={prefs ?? { notify_social: true, notify_medals: true, notify_messages: true, notify_reminders: true, notify_weekly: true }} />

      <Link href="/mensajes" className="card flex items-center gap-3 p-4">
        <span className="text-2xl">✉️</span>
        <div className="flex-1">
          <div className="font-semibold">{t("Mensajes con el equipo")}</div>
          <div className="text-xs text-muted">{t("¿Dudas con la plani o tus resultados? Escríbenos.")}</div>
        </div>
        <span className="text-accent">→</span>
      </Link>

      <Link href="/medallas" className="card flex items-center gap-3 p-4">
        <div className="flex -space-x-3">
          {MEDALS.filter((m) => ownedMedals.has(m.code))
            .slice(-4)
            .map((m) => (
              <MedalBadge key={m.code} medal={m} unlocked size={40} />
            ))}
          {ownedMedals.size === 0 && <MedalBadge medal={MEDALS[0]} unlocked={false} size={40} />}
        </div>
        <div className="flex-1">
          <div className="font-semibold">🏅 {t("Medallas")}</div>
          <div className="text-xs text-muted">{t("{a} de {b} desbloqueadas", { a: ownedMedals.size, b: MEDALS.length })}</div>
        </div>
        <span className="text-accent">→</span>
      </Link>

      <section className="space-y-2">
        <h2 className="h-display text-xl">{t("Idioma")}</h2>
        <LangSwitcher />
      </section>

      <section className="space-y-2">
        <h2 className="h-display text-xl">{t("Tus datos")}</h2>
        <p className="text-sm text-muted">{user.email}</p>
        <div className="card p-4">
          <AvatarUpload name={profile?.full_name ?? ""} url={profile?.avatar_url ?? null} />
        </div>
        <PersonalForm profile={me} />
        <Link href={`/atleta/${user.id}`} className="block text-center text-sm text-muted underline">
          👀 {t("Ver mi perfil público")}
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="h-display text-xl">{t("📲 Instala la app")}</h2>
        <p className="text-sm text-muted">{t("Es una app web: la añades a la pantalla de inicio y se abre como una app normal, con el icono TC.")}</p>
        <InstallHelp />
      </section>

      <section className="space-y-2">
        <h2 className="h-display text-xl">{t("📘 Manual de uso")}</h2>
        <Link href="/ayuda" className="card flex items-center justify-between p-4 font-semibold">
          {t("Cómo funciona la app")} <span className="text-accent">→</span>
        </Link>
        {isCoachProfile(profile) && (
          <Link href="/ayuda/coaches" className="card flex items-center justify-between p-4 font-semibold">
            {t("Manual para coaches y admins")} <span className="text-accent">→</span>
          </Link>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="h-display text-xl">{t("Contraseña")}</h2>
        <PasswordForm />
      </section>

      {profile?.is_admin && (
        <Link href="/admin" className="card flex items-center justify-between p-4 font-semibold">
          {t("Administración")} <span className="text-accent">→</span>
        </Link>
      )}

      <Link href="/boxes?cambiar=1" className="card flex items-center justify-between p-4">
        <span>
          <span className="block text-xs uppercase tracking-wider text-muted">{t("Tu box")}</span>
          <span className="font-semibold">{box.name}</span>
        </span>
        <span className="text-sm text-accent">{t("Cambiar o crear box")} →</span>
      </Link>

      {sp.salir === "admin" && (
        <p className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm">{t("Eres el único admin del box: nombra a otro admin antes de salirte.")}</p>
      )}
      <form action={leaveBox} className="text-center">
        <ConfirmDelete label={t("Salir de este box")} confirmLabel={t("¿Salir de {box}? Pulsa otra vez", { box: box.name })} className="text-sm" />
      </form>

      <form action={logout}>
        <button className="btn-ghost w-full py-3 text-muted">{t("Cerrar sesión")}</button>
      </form>
    </div>
  );
}
