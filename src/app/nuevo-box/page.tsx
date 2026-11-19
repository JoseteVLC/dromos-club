import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { LangSwitcher } from "@/components/lang-switcher";
import { BRAND } from "@/lib/brand";
import { NewBoxForm } from "@/components/new-box-form";

export const metadata = { title: `Crea tu box · ${BRAND.name}` };

export default async function NewBoxPage() {
  const supabase = await createClient(null);
  const { data } = await supabase.auth.getClaims();
  const { t } = await getI18n();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.logo} alt={BRAND.name} className="mx-auto h-8 w-auto" />
        <h1 className="h-title mt-6 text-3xl">{t("Crea el leaderboard de tu box")}</h1>
        <p className="mt-2 text-sm text-muted">{t("En un minuto tienes tu box con su dirección propia. Luego invitas a tus coaches y atletas.")}</p>
      </div>
      <NewBoxForm loggedIn={!!data?.claims?.sub} />
      <LangSwitcher compact />
    </main>
  );
}
