import { createClient } from "@/lib/supabase/server";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import { LangSwitcher } from "@/components/lang-switcher";
import { BRAND } from "@/lib/brand";
import { JoinBoxForm } from "@/components/join-box-form";

export const metadata = { title: `Únete · ${BRAND.name}` };

/** Página del QR de la pizarra: cada atleta se da de alta solo. */
export default async function JoinPage({ params }: PageProps<"/unirse/[code]">) {
  const { code } = await params;
  const { t } = await getI18n();
  const box = hasAdminKey()
    ? (await adminDb().from("boxes").select("name, logo_url, join_mode").eq("join_code", code).maybeSingle<{ name: string; logo_url: string | null; join_mode: string }>()).data
    : null;
  const supabase = await createClient(null);
  const loggedIn = !!(await supabase.auth.getClaims()).data?.claims?.sub;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        {box?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={box.logo_url} alt="" className="mx-auto h-16 w-16 rounded-xl object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={BRAND.logo} alt={BRAND.name} className="mx-auto h-8 w-auto" />
        )}
        {box ? (
          <>
            <h1 className="h-title mt-6 text-3xl">{t("Únete a {box}", { box: box.name })}</h1>
            <p className="mt-2 text-sm text-muted">{t("Mete tus resultados de cada WOD, guarda tus marcas y compárate con el resto del box.")}</p>
          </>
        ) : (
          <h1 className="h-title mt-6 text-2xl">{t("Este código ya no vale. Pide al box el QR nuevo.")}</h1>
        )}
      </div>
      {box && <JoinBoxForm code={code} loggedIn={loggedIn} boxName={box.name} approval={box.join_mode !== "open"} />}
      <LangSwitcher compact />
    </main>
  );
}
