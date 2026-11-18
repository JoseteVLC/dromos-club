import Link from "next/link";
import { isCoachProfile, requireUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import type { Result } from "@/lib/types";
import { BENCH_CATEGORIES, RM_CATEGORIES, bestPR, formatPR, type BenchCategory, type Benchmark, type PersonalRecord } from "@/lib/marcas";
import { HistoryTabs } from "@/components/history-tabs";
import { BenchmarkForm } from "@/components/pr-form";

export default async function MarcasPage({ searchParams }: PageProps<"/marcas">) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireUser();
  const { t, locale } = await getI18n();
  const cat = (BENCH_CATEGORIES.some((c) => c.value === sp.c) ? sp.c : "girls") as BenchCategory;
  const q = String(sp.q ?? "").trim().slice(0, 40);
  const isCoach = isCoachProfile(profile);

  const [{ data: benches }, { data: mine }] = await Promise.all([
    supabase.from("benchmarks").select("*").order("sort").order("name").returns<Benchmark[]>(),
    supabase.from("personal_records").select("*").eq("user_id", user.id).returns<PersonalRecord[]>(),
  ]);
  const all = benches ?? [];
  const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = q ? all.filter((b) => norm(b.name).includes(norm(q))) : [];
  const byBench = new Map<string, PersonalRecord[]>();
  for (const pr of mine ?? []) byBench.set(pr.benchmark_id, [...(byBench.get(pr.benchmark_id) ?? []), pr]);
  // Tus resultados en WODs que se llaman igual que un benchmark (un «Fran» de la plani) también cuentan
  const { data: myWodRes } = await supabase
    .from("results")
    .select("*, wods!inner(wod_date, title, score_type)")
    .eq("user_id", user.id)
    .limit(500)
    .returns<(Result & { wods: { wod_date: string; title: string; score_type: string } })[]>();
  const byName = new Map(all.map((b) => [`${norm(b.name).trim()}|${b.score_type}`, b]));
  for (const r of myWodRes ?? []) {
    const b = byName.get(`${norm(r.wods.title).trim()}|${r.wods.score_type}`);
    if (!b) continue;
    const pr: PersonalRecord = {
      id: `wod-${r.id}`,
      user_id: r.user_id,
      benchmark_id: b.id,
      performed_on: r.wods.wod_date,
      division: r.division === "scaled" ? "scaled" : "rx",
      rm: 1,
      finished: r.finished,
      time_seconds: r.time_seconds,
      rounds: r.rounds,
      reps: r.reps,
      value: r.value,
      notes: r.notes,
    };
    byBench.set(b.id, [...(byBench.get(b.id) ?? []), pr]);
  }
  const done = all.filter((b) => byBench.has(b.id)).length;
  const fmtDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  const renderList = (items: Benchmark[]) => (
    <ul className="divide-y divide-line">
      {items.map((b) => {
        const prs = byBench.get(b.id) ?? [];
        const isRM = RM_CATEGORIES.includes(b.category);
        // En levantamientos, el PR que se enseña es el del menor RM apuntado (normalmente 1RM)
        const pool = isRM && prs.length ? prs.filter((p) => (p.rm ?? 1) === Math.min(...prs.map((x) => x.rm ?? 1))) : prs;
        const best = bestPR(b, pool);
        return (
          <li key={b.id}>
            <Link href={`/marcas/${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-line/40">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{b.name}</div>
                {b.description && <div className="truncate text-xs text-muted">{b.description}</div>}
              </div>
              {best ? (
                <div className="text-right">
                  <div className="h-display text-xl tabular-nums text-accent">
                    {formatPR(b, best)}
                    {isRM && <span className="ml-1 text-xs text-muted">{best.rm ?? 1}RM</span>}
                  </div>
                  <div className="text-[11px] text-muted">
                    {best.division === "scaled" ? `${t("Escalado")} · ` : ""}
                    {fmtDate(best.performed_on)}
                  </div>
                </div>
              ) : (
                <span className="text-lg text-muted">+</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-5">
      <h1 className="h-title text-5xl">{t("Historial")}</h1>
      <HistoryTabs active="marcas" t={t} />
      <p className="text-sm text-muted">
        {t("Apunta tus marcas con fecha: benchmarks, héroes, RM de básicos y halterofilia… La mejor de cada uno es tu PR.")}{" "}
        {t("Llevas {n} de {total}.", { n: done, total: all.length })}
      </p>

      <form action="/marcas" className="flex gap-2">
        <input name="q" defaultValue={q} className="input" placeholder={t("Buscar (Fran, Murph, snatch…)")} />
        <button className="btn shrink-0 px-4">{t("Buscar")}</button>
      </form>

      {q ? (
        list.length === 0 ? (
          <p className="card p-5 text-sm text-muted">{t("No hay nada con ese nombre.")}</p>
        ) : (
          <div className="card overflow-hidden">{renderList(list)}</div>
        )
      ) : (
        <div className="space-y-3">
          {BENCH_CATEGORIES.map((c) => {
            const items = all.filter((b) => b.category === c.value);
            const doneHere = items.filter((b) => byBench.has(b.id)).length;
            return (
              <details key={c.value} open={sp.c === c.value} className="card group overflow-hidden">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4">
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="h-display flex-1 text-2xl">{t(c.label)}</span>
                  <span className="text-xs text-muted">
                    {doneHere}/{items.length}
                  </span>
                  <span className="text-muted transition group-open:rotate-90">›</span>
                </summary>
                <div className="border-t border-line">
                  {renderList(items)}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {isCoach && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted">{t("➕ Añadir un benchmark al catálogo (coaches)")}</summary>
          <BenchmarkForm defaultCategory={cat} />
        </details>
      )}
      <p className="text-xs text-muted">{t("Pesos en kg: hombres / mujeres.")}</p>
    </div>
  );
}
