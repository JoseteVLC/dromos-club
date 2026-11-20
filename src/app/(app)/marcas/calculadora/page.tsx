import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { myLifts } from "@/lib/lifts";
import { HistoryTabs } from "@/components/history-tabs";
import { PlateCalc } from "@/components/plate-calc";
import { Icon } from "@/components/icon";

/** Calculadora de % y discos con tus 1RM de básicos y halterofilia. */
export default async function CalculadoraPage() {
  const { supabase, user } = await requireUser();
  const { t } = await getI18n();
  const lifts = await myLifts(supabase, user.id);

  return (
    <div className="space-y-5">
      <h1 className="h-title text-5xl">{t("Historial")}</h1>
      <HistoryTabs active="marcas" t={t} />
      <Link href="/marcas?c=lifts" className="text-sm text-muted">← {t("Mis marcas")}</Link>
      <h2 className="h-display flex items-center gap-2 text-3xl"><Icon name="plates" size={22} tile /> {t("Calculadora de % y discos")}</h2>
      <p className="text-sm text-muted">
        {lifts.length
          ? t("Elige el movimiento o escribe tu 1RM, toca el % y te dice qué discos poner a cada lado.")
          : t("Escribe tu 1RM y toca el %, o escribe directamente el peso. Si apuntas tus RM en Mis marcas, saldrán aquí para elegirlos.")}
      </p>
      <PlateCalc lifts={lifts} />
    </div>
  );
}
