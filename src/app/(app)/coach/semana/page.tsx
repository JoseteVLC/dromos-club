import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { requireCoach } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/dates";
import { mondayOf } from "@/lib/week-parser";
import { WeekImport } from "@/components/week-import";

// La lectura de fotos con IA puede tardar unos segundos
export const maxDuration = 120;

export default async function SemanaPage() {
  await requireCoach();
  const { t } = await getI18n();
  // Por defecto, la semana que viene (lo normal es subir la plani antes de que empiece)
  const nextMonday = addDays(mondayOf(todayISO()), 7);
  return (
    <div className="space-y-4">
      <Link href="/coach" className="text-sm text-muted hover:text-fg">← Coach</Link>
      <h1 className="h-title text-5xl">{t("Importar WODs")}</h1>
      <WeekImport defaultMonday={nextMonday} today={todayISO()} />
    </div>
  );
}
