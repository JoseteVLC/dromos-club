import Link from "next/link";
import { HistoryTabs } from "@/components/history-tabs";
import { requireUser } from "@/lib/supabase/server";
import { DIVISION_ORDER, compareScore, formatScore, formatScore2, rankResults } from "@/lib/scoring";
import { dayHref, dayLabel } from "@/lib/dates";
import { DIVISIONS, SCORE_TYPES, type Division, type Result, type Wod } from "@/lib/types";
import { getI18n } from "@/lib/i18n/server";
import { todayISO } from "@/lib/dates";
import { RM_CATEGORIES, asResult, formatPR, type Benchmark, type PersonalRecord } from "@/lib/marcas";
import type { ScoreType } from "@/lib/types";
import { Icon } from "@/components/icon";

type MyResult = Result & { wods: Wod };

const divLabel = (d: Division) => DIVISIONS.find((x) => x.value === d)?.label ?? d;

export default async function HistorialPage({ searchParams }: PageProps<"/historial">) {
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 60);
  const onlyBench = sp.b === "1";
  const months = Math.min(Math.max(Number(sp.m) || 3, 3), 120);
  const { supabase, user } = await requireUser();
  const { t, locale } = await getI18n();
  const today = todayISO();

  const { data } = await supabase
    .from("results")
    .select("*, wods!inner(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<MyResult[]>();
  const mine = (data ?? []).sort((a, b) =>
    b.wods.wod_date.localeCompare(a.wods.wod_date) || a.wods.part.localeCompare(b.wods.part),
  );

  // Marcas personales (Mis marcas) y catálogo de benchmarks: forman parte del historial y de los PRs
  const [{ data: benchData }, { data: marcaData }] = await Promise.all([
    supabase.from("benchmarks").select("*").returns<Benchmark[]>(),
    supabase.from("personal_records").select("*").eq("user_id", user.id).order("performed_on", { ascending: false }).limit(300).returns<PersonalRecord[]>(),
  ]);
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const benchById = new Map((benchData ?? []).map((b) => [b.id, b]));
  const benchByName = new Map((benchData ?? []).map((b) => [norm(b.name), b]));
  const marcas = (marcaData ?? []).filter((m) => benchById.has(m.benchmark_id));
  // Un WOD cuenta como benchmark si el coach lo marcó o si se llama igual que uno del catálogo (Fran, Murph…)
  // Los WODs de carga no: cada levantamiento ya sale como su propia marca (Back squat 1RM, Bench press 1RM…)
  const isBench = (w: Wod) => w.score_type !== "load" && (w.is_benchmark || benchByName.has(norm(w.title)));

  // Historial: resultados de WODs + marcas personales, juntos por fecha
  type Item = { kind: "wod"; date: string; r: MyResult } | { kind: "marca"; date: string; m: PersonalRecord; b: Benchmark };
  const items: Item[] = [
    ...mine.map((r) => ({ kind: "wod" as const, date: r.wods.wod_date, r })),
    ...marcas.map((m) => ({ kind: "marca" as const, date: m.performed_on, m, b: benchById.get(m.benchmark_id)! })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const itemTitle = (it: Item) => (it.kind === "wod" ? it.r.wods.title : it.b.name);
  const filtered = items.filter(
    (it) => (!onlyBench || it.kind === "marca" || isBench(it.r.wods)) && (!q || norm(itemTitle(it)).includes(norm(q))),
  );
  const monthKeys = [...new Set(filtered.map((it) => it.date.slice(0, 7)))];
  // Sin buscador se muestran los últimos N meses; con buscador, todo lo que coincida
  const shownMonths = q || onlyBench ? monthKeys : monthKeys.slice(0, months);
  const visibleItems = filtered.filter((it) => shownMonths.includes(it.date.slice(0, 7)));
  const visible = visibleItems.flatMap((it) => (it.kind === "wod" ? [it.r] : []));
  const byMonth = shownMonths.map((m) => ({ m, items: visibleItems.filter((it) => it.date.startsWith(m)) }));
  const monthName = (m: string) => {
    const s = new Date(`${m}-15T12:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const qs = (o: { q?: string; b?: boolean; m?: number }) => {
    const u = new URLSearchParams();
    if (o.q) u.set("q", o.q);
    if (o.b) u.set("b", "1");
    if (o.m && o.m > 3) u.set("m", String(o.m));
    const str = u.toString();
    return `/historial${str ? `?${str}` : ""}`;
  };

  // Posición en el absoluto de cada WOD (solo de lo que se ve)
  const wodIds = visible.map((r) => r.wod_id);
  const { data: all } = wodIds.length
    ? await supabase.from("results").select("*, profiles!results_user_id_fkey(full_name, gender)").in("wod_id", wodIds).returns<Result[]>()
    : { data: [] as Result[] };
  const byWod = new Map<string, Result[]>();
  for (const r of all ?? []) byWod.set(r.wod_id, [...(byWod.get(r.wod_id) ?? []), r]);
  const position = (r: MyResult) => {
    const ranked = rankResults(r.wods, byWod.get(r.wod_id) ?? [r]);
    return { rank: ranked.find((x) => x.user_id === user.id)?.rank ?? 0, total: ranked.length };
  };

  // PRs: mejor marca por benchmark, juntando WODs (marcados o con nombre del catálogo) y Mis marcas
  type Cand = { key: string; name: string; type: ScoreType; date: string; division: Division; res: Result; display: string; href: string; src: "wod" | "marca" };
  const cands: Cand[] = [];
  for (const r of mine.filter((x) => isBench(x.wods) && x.division !== "scaled")) {
    const cat = benchByName.get(norm(r.wods.title));
    cands.push({
      key: `${norm(r.wods.title)}|${r.wods.score_type}|1`,
      name: cat?.name ?? r.wods.title,
      type: r.wods.score_type,
      date: r.wods.wod_date,
      division: r.division,
      res: r,
      display: formatScore(r.wods, r),
      href: cat ? `/marcas/${cat.id}` : dayHref(r.wods.wod_date, { w: r.wod_id }),
      src: "wod",
    });
  }
  for (const m of marcas.filter((x) => x.division === "rx")) {
    const bm = benchById.get(m.benchmark_id)!;
    const rm = RM_CATEGORIES.includes(bm.category) ? (m.rm ?? 1) : 1;
    cands.push({
      key: `${norm(bm.name)}|${bm.score_type}|${rm}`,
      name: rm > 1 ? `${bm.name} · ${rm}RM` : bm.name,
      type: bm.score_type,
      date: m.performed_on,
      division: "rx",
      res: asResult(m),
      display: formatPR(bm, m),
      href: `/marcas/${bm.id}`,
      src: "marca",
    });
  }
  const prGroups = new Map<string, Cand[]>();
  for (const c of cands) prGroups.set(c.key, [...(prGroups.get(c.key) ?? []), c]);
  const prs = [...prGroups.values()]
    .map((list) => ({
      best: [...list].sort((a, b) => DIVISION_ORDER[a.division] - DIVISION_ORDER[b.division] || compareScore(a.type, a.res, b.res))[0],
      attempts: list.length,
    }))
    .sort((a, b) => a.best.name.localeCompare(b.best.name));

  return (
    <div className="space-y-8">
      <h1 className="h-title text-5xl">{t("Historial")}</h1>
      <HistoryTabs active="results" t={t} />

      <section className="space-y-3">
        <h2 className="h-display text-3xl">★ {t("Mis PRs")}</h2>
        {prs.length === 0 ? (
          <p className="card p-5 text-sm text-muted">
            {t("Aún no tienes PRs. Apúntalos en «Mis marcas» o mete resultado en un WOD benchmark (Fran, Grace, 1RM…).")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {prs.map(({ best, attempts }) => (
              <li key={best.key}>
                <Link href={best.href} className="card block p-3 transition hover:border-muted">
                  <div className="truncate text-xs font-semibold uppercase tracking-wider text-muted">{best.name}</div>
                  <div className="h-display mt-1 text-3xl text-accent">{best.display}</div>
                  <div className="mt-1 text-xs text-muted">
                    <span className="uppercase">{t(divLabel(best.division))}</span>
                    {attempts > 1 && ` · ${t("{n} veces", { n: attempts })}`}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    <Icon name="calendar" size={13} /> {new Date(best.date + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                    {(() => {
                      const months = Math.floor((Date.parse(today) - Date.parse(best.date)) / (30.44 * 86400000));
                      if (months < 1) return null;
                      return ` · ${months >= 12 ? t("hace {n} a", { n: Math.floor(months / 12) }) : t("hace {n} m", { n: months })}`;
                    })()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="h-display text-3xl">{t("Mis resultados")}</h2>
        {items.length > 0 && (
          <form className="space-y-2" action="/historial">
            <div className="flex gap-2">
              <input name="q" defaultValue={q} className="input" placeholder={t("Buscar WOD (Fran, back squat…)")} />
              {onlyBench && <input type="hidden" name="b" value="1" />}
              <button className="btn shrink-0 px-4">{t("Buscar")}</button>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                href={qs({ q, b: !onlyBench })}
                className={`rounded-full border px-3 py-1 ${onlyBench ? "border-accent bg-accent text-accent-fg" : "border-line text-muted"}`}
              >
                ★ {t("Solo benchmarks")}
              </Link>
              {(q || onlyBench) && (
                <Link href="/historial" className="rounded-full border border-line px-3 py-1 text-muted">
                  ✕ {t("Quitar filtros")}
                </Link>
              )}
            </div>
          </form>
        )}
        {items.length === 0 ? (
          <p className="card p-5 text-sm text-muted">{t("Todavía no has metido ningún resultado.")}</p>
        ) : visibleItems.length === 0 ? (
          <p className="card p-5 text-sm text-muted">{t("No hay resultados con estos filtros.")}</p>
        ) : (
          <div className="space-y-5">
            {byMonth.map(({ m, items }) => (
              <div key={m} className="space-y-2">
                <h3 className="flex items-baseline justify-between text-sm font-semibold uppercase tracking-wider text-muted">
                  <span>{monthName(m)}</span>
                  <span className="text-xs font-normal normal-case">{items.length === 1 ? t("1 resultado") : t("{n} resultados", { n: items.length })}</span>
                </h3>
                <ul className="card divide-y divide-line">
                  {items.map((it) => {
                    if (it.kind === "marca") {
                      const { m, b: bm } = it;
                      const rm = RM_CATEGORIES.includes(bm.category) ? (m.rm ?? 1) : null;
                      return (
                        <li key={`m-${m.id}`}>
                          <Link href={`/marcas/${bm.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-line/40">
                            <div className="w-14 shrink-0 text-xs text-muted">{dayLabel(m.performed_on, today, t, locale)}</div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold">
                                <Icon name="dumbbell" size={14} className="mr-1" />
                                {bm.name}
                                {rm && <span className="ml-1 text-xs text-muted">{rm}RM</span>}
                              </div>
                              <div className="text-xs text-muted">
                                {t("Marca personal")}
                                {m.division === "scaled" && ` · ${t("Escalado")}`}
                              </div>
                            </div>
                            <div className="h-display text-xl tabular-nums">{formatPR(bm, m)}</div>
                          </Link>
                        </li>
                      );
                    }
                    const r = it.r;
                    const pos = position(r);
                    const s2 = r.division === "scaled" ? null : formatScore2(r.wods, r);
                    return (
                      <li key={r.id}>
                        <Link href={dayHref(r.wods.wod_date, { w: r.wod_id })} className="flex items-center gap-3 px-4 py-3 hover:bg-line/40">
                          <div className="w-14 shrink-0 text-xs text-muted">{dayLabel(r.wods.wod_date, today, t, locale)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold">
                              <span className="mr-1 text-accent">{r.wods.part}</span>
                              {r.wods.title}
                              {isBench(r.wods) && " ★"}
                            </div>
                            <div className="text-xs text-muted">
                              <span className="uppercase">{t(divLabel(r.division))}</span>
                              {r.division !== "scaled" && ` · ${t(SCORE_TYPES[r.wods.score_type].label)}`}
                              {s2 && ` · ${s2}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="h-display text-xl tabular-nums">{r.division === "scaled" ? "✓" : formatScore(r.wods, r)}</div>
                            <div className="text-xs text-muted">
                              {r.division === "scaled" ? t("sin ranking") : t("{rank}º de {total}", { rank: pos.rank, total: pos.total })}
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!q && !onlyBench && monthKeys.length > shownMonths.length && (
              <Link href={qs({ m: months + 6 })} scroll={false} className="block text-center text-sm font-semibold text-muted underline">
                {t("Ver meses anteriores")}
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
