import Link from "next/link";
import { adminDb } from "@/lib/supabase/admin";
import { AcceptInviteForm } from "@/components/account-forms";
import { getI18n } from "@/lib/i18n/server";
import { LangSwitcher } from "@/components/lang-switcher";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Invitación · ${BRAND.name}` };

export default async function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const { t } = await getI18n();
  const { data: inv } = await adminDb()
    .from("invitations")
    .select("email, first_name, last_name, accepted_at")
    .eq("token", token)
    .maybeSingle<{ email: string; first_name: string; last_name: string; accepted_at: string | null }>();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.logo} alt={BRAND.name} className="mx-auto h-8 w-auto" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.4em] text-muted">Club</p>
        <div className="mt-4">
          <LangSwitcher compact />
        </div>
      </div>
      {!inv ? (
        <div className="card space-y-3 p-6 text-center">
          <p className="h-title text-2xl">{t("Invitación no válida")}</p>
          <p className="text-sm text-muted">{t("Puede que la hayan anulado o que el enlace esté incompleto. Pide una nueva.")}</p>
        </div>
      ) : inv.accepted_at ? (
        <div className="card space-y-4 p-6 text-center">
          <p className="h-title text-2xl">{t("Ya tienes cuenta")}</p>
          <p className="text-sm text-muted">{t("Esta invitación ya se usó. Entra con tu email ({email}) y tu contraseña.", { email: inv.email })}</p>
          <Link href="/login" className="btn w-full">{t("Entrar")}</Link>
        </div>
      ) : (
        <>
          <div className="space-y-2 text-center">
            <h1 className="h-title text-4xl">{inv.first_name ? t("¡Hola, {name}!", { name: inv.first_name }) : t("¡Hola!")}</h1>
            <p className="text-sm text-muted">
              {t("Te han invitado al leaderboard de {app}: mete tus resultados de los WODs y compárate con el resto. Crea tu contraseña y listo.")}
            </p>
          </div>
          <AcceptInviteForm token={token} email={inv.email} firstName={inv.first_name} lastName={inv.last_name} />
        </>
      )}
    </main>
  );
}
