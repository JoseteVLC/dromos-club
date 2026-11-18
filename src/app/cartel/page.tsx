import { requireAdmin } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/site";
import { joinUrl, qrSvg } from "@/lib/qr";
import { BRAND } from "@/lib/brand";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: `Cartel QR · ${BRAND.name}` };

/** Cartel A4 con el QR del box, para imprimir o guardar en PDF desde el navegador. */
export default async function PosterPage() {
  const { box } = await requireAdmin();
  const { t } = await getI18n();
  const url = joinUrl(await siteUrl(), box.join_code);
  const svg = await qrSvg(url, 0);
  return (
    <main className="poster mx-auto flex min-h-screen max-w-[210mm] flex-col items-center justify-between gap-8 bg-white px-10 py-12 text-center text-[#0C0D10]">
      <style>{`@page { size: A4; margin: 0 } @media print { .no-print { display: none !important } body { background: #fff } .poster { min-height: 297mm } }`}</style>
      <div className="no-print fixed right-4 top-4"><PrintButton /></div>
      <div className="space-y-3">
        {box.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={box.logo_url} alt="" className="mx-auto h-24 w-24 rounded-2xl object-cover" />
        )}
        <p className="font-display text-6xl font-bold uppercase leading-none">{box.name}</p>
        <p className="font-display text-3xl font-bold uppercase">{t("Leaderboard del box")}</p>
      </div>
      <div className="w-[120mm] max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <ol className="space-y-2 text-left text-xl font-semibold">
        <li>1. {t("Escanea el QR con la cámara del móvil")}</li>
        <li>2. {t("Crea tu cuenta en un minuto")}</li>
        <li>3. {t("Mete tu resultado después de cada WOD")}</li>
      </ol>
      <div className="flex items-center gap-2 text-sm text-[#55575d]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.mark} alt="" className="h-5 w-auto brightness-0" />
        <span>{BRAND.name}</span>
      </div>
    </main>
  );
}
