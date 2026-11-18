import { logout } from "@/app/actions";
import { getI18n } from "@/lib/i18n/server";
import { BRAND } from "@/lib/brand";
import { publicBox } from "@/lib/box-public";
import Link from "next/link";

export const metadata = { title: `Cuenta desactivada · ${BRAND.short}` };

export default async function InactivePage({ searchParams }: PageProps<"/inactivo">) {
  const { t } = await getI18n();
  const sp = await searchParams;
  const pending = typeof sp.pendiente === "string" ? await publicBox(sp.pendiente) : null;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND.logo} alt={BRAND.name} className="mx-auto h-8 w-auto" />
      <div className="card space-y-3 p-6">
        {pending ? (
          <>
            <p className="h-title text-3xl">{t("Solicitud enviada")}</p>
            <p className="text-sm text-muted">{t("{box} tiene que aceptarte. Suele ser rápido: vuelve a abrir la app en un rato y ya estarás dentro.", { box: pending.name })}</p>
          </>
        ) : (
          <>
            <p className="h-title text-3xl">{t("Tu cuenta no está activa")}</p>
            <p className="text-sm text-muted">
              {t("Tus resultados siguen guardados. Si vuelves a tu box, te reactivan la cuenta con el mismo email y lo tendrás todo como lo dejaste.")}
            </p>
          </>
        )}
      </div>
      <Link href="/boxes?cambiar=1" className="btn-ghost w-full py-3">{t("Ir a mis boxes")}</Link>
      <form action={logout}>
        <button className="btn-ghost w-full py-3 text-muted">{t("Cerrar sesión")}</button>
      </form>
    </main>
  );
}
