import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/supabase/server";
import type { Wod } from "@/lib/types";
import { WodForm } from "@/components/wod-form";
import { deleteWod } from "@/app/actions";
import { ConfirmDelete } from "@/components/ui";
import { dayHref } from "@/lib/dates";

export default async function EditWodPage({ params }: PageProps<"/coach/[id]">) {
  const { id } = await params;
  const { supabase } = await requireCoach();
  const { t } = await getI18n();
  const { data: wod } = await supabase.from("wods").select("*").eq("id", id).maybeSingle<Wod>();
  if (!wod) notFound();

  return (
    <div className="space-y-4">
      <Link href={dayHref(wod.wod_date, { w: wod.id })} className="text-sm text-muted hover:text-fg">← {t("Volver al día")}</Link>
      <h1 className="h-title text-5xl">{t("Editar WOD")}</h1>
      <WodForm wod={wod} />
      <form action={deleteWod} className="text-right">
        <input type="hidden" name="id" value={wod.id} />
        <input type="hidden" name="wod_date" value={wod.wod_date} />
        <ConfirmDelete label={t("Borrar WOD y todos sus resultados")} confirmLabel={t("Toca otra vez para borrar el WOD y sus resultados")} className="text-sm text-red-400" />
      </form>
    </div>
  );
}
