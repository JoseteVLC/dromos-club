import { LoginForm } from "@/components/login-form";
import { LangSwitcher } from "@/components/lang-switcher";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { currentBoxSlug } from "@/lib/supabase/server";
import { publicBox } from "@/lib/box-public";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const { t } = await getI18n();
  const box = await publicBox(await currentBoxSlug()).catch(() => null);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.logo} alt={BRAND.name} className="mx-auto h-9 w-auto" />
        {box ? (
          <div className="mt-6 flex items-center justify-center gap-3">
            {box.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={box.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            )}
            <p className="font-display text-2xl font-bold uppercase">{box.name}</p>
          </div>
        ) : (
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.4em] text-muted">Club</p>
        )}
        <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-accent">{t("Cada WOD cuenta.")}</p>
      </div>
      {sp.error === "confirm" && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {t("El enlace de confirmación no es válido o ha caducado.")}
        </p>
      )}
      <LoginForm next={typeof sp.next === "string" ? sp.next : ""} />
      <p className="text-center text-sm text-muted">
        {t("¿Tienes un box y quieres usar {app}?")}{" "}
        <Link href="/nuevo-box" className="font-semibold text-accent underline">
          {t("Créalo aquí")}
        </Link>
      </p>
      <LangSwitcher compact />
    </main>
  );
}
