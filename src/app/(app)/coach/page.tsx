import Link from "next/link";
import { Icon } from "@/components/icon";
import { getI18n } from "@/lib/i18n/server";
import { requireCoach } from "@/lib/supabase/server";
import { SCORE_TYPES, type Wod } from "@/lib/types";
import { WodForm } from "@/components/wod-form";
import { addDays, dayHref, isISODate, todayISO } from "@/lib/dates";
import { FlaggedResults, type FlaggedRow } from "@/components/flagged-results";
import { FlaggedRecords, type FlaggedRecord } from "@/components/flagged-records";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";

export default async function CoachPage({ searchParams }: PageProps<"/coach">) {
  const sp = await searchParams;
  const defaultDate = isISODate(String(sp.date)) ? String(sp.date) : undefined;
  const defaultPart = /^[A-Z]$/.test(String(sp.part)) ? String(sp.part) : undefined;
  const { supabase, box } = await requireCoach();
  const { t } = await getI18n();
  const { data } = await supabase
    .from("wods")
    .select("*")
    .order("wod_date", { ascending: false })
    .order("part")
    .limit(30)
    .returns<Wod[]>();
  // Resultados marcados por el detector en las dos últimas semanas
  const { data: flagged } = await supabase
    .from("results")
    .select("*, wods!inner(id, title, part, wod_date, score_type, score_label), profiles!results_user_id_fkey(full_name, gender, avatar_url)")
    .not("flag", "is", null)
    .eq("flag_reviewed", false)
    .gte("wods.wod_date", addDays(todayISO(), -14))
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<FlaggedRow[]>();

  // Marcas personales imposibles confirmadas por el atleta (con la clave de servidor: el coach no ve las marcas privadas)
  let flaggedPrs: FlaggedRecord[] = [];
  if (hasAdminKey()) {
    let q = adminDb()
      .from("personal_records")
      .select("*, benchmarks(name, score_type), profiles!personal_records_user_id_fkey(id, full_name, avatar_url)")
      .not("flag", "is", null)
      .eq("flag_reviewed", false)
      .order("created_at", { ascending: false })
      .limit(30);
    const { data: mem } = await adminDb().from("box_members").select("user_id").eq("box_id", box.id);
    q = q.in("user_id", (mem ?? []).map((m) => m.user_id as string));
    flaggedPrs = ((await q.returns<FlaggedRecord[]>()).data ?? []);
  }

  return (
    <div className="space-y-8">
      <FlaggedResults rows={flagged ?? []} t={t} />
      <FlaggedRecords rows={flaggedPrs} t={t} />
      <Link href="/coach/panel" className="card flex items-center justify-between border-accent/60 p-4">
        <span>
          <span className="h-display flex items-center gap-3 text-2xl"><Icon name="chart" size={20} tile /> {t("Panel del box")}</span>
          <span className="text-sm text-muted">{t("Activos por semana, asistencia, WODs más hechos y quién está dejando de venir")}</span>
        </span>
        <span className="text-2xl text-accent">→</span>
      </Link>
      <Link href="/coach/semana" className="card flex items-center justify-between border-accent/60 p-4">
        <span>
          <span className="h-display block text-2xl">{t("Importar WODs")}</span>
          <span className="text-sm text-muted"><span className="inline-flex items-center gap-1.5"><Icon name="camera" size={14} /> {t("Foto de la pizarra, Word de la plani o texto copiado")}</span></span>
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
