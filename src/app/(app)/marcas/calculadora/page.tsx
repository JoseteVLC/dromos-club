import Link from "next/link";
import { BarbellIcon } from "@/components/icons";
import { requireUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { RM_CATEGORIES, type Benchmark, type PersonalRecord } from "@/lib/marcas";
import { HistoryTabs } from "@/components/history-tabs";
import { PlateCalc } from "@/components/plate-calc";

/** 1RM estimado (Epley); con 1RM devuelve el propio peso. */
const epley = (r: PersonalRecord) => {
  const w = Number(r.value ?? 0);
  const n = r.rm ?? 1;
  return n <= 1 ? w : w * (1 + n / 30);
};

/** Calculadora de % y discos con tus 1RM de básicos y halterofilia. */
export default async function CalculadoraPage() {
  const { supabase, user } = await requireUser();
  const { t } = await getI18n();
  const [{ data: benches }, { data: prs }] = await Promise.all([
    supabase.from("benchmarks").select("id, name, category, sort").in("category", RM_CATEGORIES).order("sort").order("name").returns<Pick<Benchmark, "id" | "name" | "category">[]>(),
    supabase.from("personal_records").select("*").eq("user_id", user.id).eq("division", "rx").not("value", "is", null).returns<PersonalRecord[]>(),
  ]);
  const best = new Map<string, number>();
  for (const r of prs ?? []) best.set(r.benchmark_id, Math.max(best.get(r.benchmark_id) ?? 0, epley(r)));
  const lifts = (benches ?? [])
    .filter((b) => (best.get(b.id) ?? 0) > 0)
    .map((b) => ({ name: b.name, oneRM: Math.round(best.get(b.id)! * 2) / 2 }));

  return (
    <div className="space-y-5">
      <h1 className="h-title text-5xl">{t("Historial")}</h1>
      <HistoryTabs active="marcas" t={t} />
      <Link href="/marcas?c=lifts" className="text-sm text-muted">← {t("Mis marcas")}</Link>
      <h2 className="h-display flex items-center gap-2 text-3xl"><BarbellIcon size={28} className="text-accent" /> {t("Calculadora de % y discos")}</h2>
      <p className="text-sm text-muted">
        {lifts.length
          ? t("Elige el movimiento y el % de tu 1RM, o escribe el peso: te dice qué discos poner a cada lado.")
          : t("Apunta tus RM en Mis marcas para calcular porcentajes. Mientras, escribe el peso y te dice qué discos poner.")}
      </p>
      <PlateCalc lifts={lifts} />
    </div>
  );
}
