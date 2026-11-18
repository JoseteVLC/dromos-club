import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { requireCoach } from "@/lib/supabase/server";
import { SCORE_TYPES, type Wod } from "@/lib/types";
import { WodForm } from "@/components/wod-form";
import { dayHref, isISODate } from "@/lib/dates";

export default async function CoachPage({ searchParams }: PageProps<"/coach">) {
  const sp = await searchParams;
  const defaultDate = isISODate(String(sp.date)) ? String(sp.date) : undefined;
  const defaultPart = /^[A-Z]$/.test(String(sp.part)) ? String(sp.part) : undefined;
  const { supabase } = await requireCoach();
  const { t } = await getI18n();
  const { data } = await supabase
    .from("wods")
    .select("*")
    .order("wod_date", { ascending: false })
    .order("part")
    .limit(30)
    .returns<Wod[]>();

  return (
    <div className="space-y-8">
      <Link href="/coach/semana" className="card flex items-center justify-between border-accent/60 p-4">
        <span>
          <span className="h-display block text-2xl">{t("Importar WODs")}</span>
          <span className="text-sm text-muted">{t("📷 Foto de la pizarra, Word de la plani o texto copiado")}</span>
        </span>
        <span className="text-2xl text-accent">→</span>
      </Link>

      <section className="space-y-3">
        <h1 className="h-title text-5xl">{t("Nuevo WOD")}</h1>
        <WodForm defaultDate={defaultDate} defaultPart={defaultPart} />
      </section>

      <section className="space-y-3">
        <h2 className="h-display text-3xl">{t("Últimos WODs")}</h2>
        <ul className="card divide-y divide-line">
          {(data ?? []).map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href={dayHref(w.wod_date, { w: w.id })} className="min-w-0">
                <div className="truncate font-semibold"><span className="mr-1 text-accent">{w.part}</span>{w.title}{w.is_benchmark && " ★"}</div>
                <div className="text-xs text-muted">
                  {w.wod_date} · {t(SCORE_TYPES[w.score_type].label)}
                  {!w.published && <span className="ml-2 text-yellow-400">{t("Borrador")}</span>}
                </div>
              </Link>
              <Link href={`/coach/${w.id}`} className="btn-ghost shrink-0">{t("Editar")}</Link>
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="px-4 py-6 text-center text-muted">{t("Aún no hay WODs.")}</li>}
        </ul>
      </section>
    </div>
  );
}
