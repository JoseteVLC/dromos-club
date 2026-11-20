import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { MIN_FOR_PERCENTILE, PercentileCard } from "@/components/percentile-card";
import { notFound } from "next/navigation";
import { isCoachProfile, requireUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { dayHref, todayISO } from "@/lib/dates";
import { BENCH_CATEGORIES, RM_CATEGORIES, comparePR, formatPR, type Benchmark, type PersonalRecord } from "@/lib/marcas";
import { deleteBenchmark, deletePersonalRecord } from "@/app/actions";
import { BenchmarkForm, PRForm } from "@/components/pr-form";
import { ConfirmDelete } from "@/components/ui";
import { PlateCalc } from "@/components/plate-calc";
import { ProgressChart, type ProgressPoint } from "@/components/progress-chart";
import type { Gender, Result } from "@/lib/types";
import { Icon } from "@/components/icon";

/** 1RM estimado (fórmula de Epley); con 1RM devuelve el propio peso. */
function epley(r: PersonalRecord) {
  const w = Number(r.value ?? 0);
  const n = r.rm ?? 1;
  return n <= 1 ? w : w * (1 + n / 30);
}
const round05 = (kg: number) => Math.round(kg * 2) / 2;

export default async function BenchmarkPage({ params, searchParams }: PageProps<"/marcas/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile } = await requireUser();
  const { t, locale } = await getI18n();
  const { data: b } = await supabase.from("benchmarks").select("*").eq("id", id).maybeSingle<Benchmark>();
  if (!b) notFound();
  const isRM = RM_CATEGORIES.includes(b.category);
  const rm = isRM ? Math.max(1, Number(sp.rm) || 1) : null;
  const gender = (["M", "F"].includes(String(sp.g)) ? sp.g : "all") as Gender | "all";
  const cat = BENCH_CATEGORIES.find((c) => c.value === b.category);

  const { data: all } = await supabase
    .from("personal_records")
    .select("*, profiles!personal_records_user_id_fkey(full_name, gender, avatar_url)")
    .eq("benchmark_id", b.id)
    .returns<PersonalRecord[]>();
  // Los WODs que se llaman igual (p. ej. un «Fran» de la plani) también cuentan como marca
  const { data: sameWods } = await supabase
    .from("wods")
    .select("id, wod_date, title, score_type")
    .ilike("title", b.name.replace(/[%_]/g, ""))
    .eq("score_type", b.score_type)
    .eq("published", true);
  const wodDate = new Map((sameWods ?? []).map((w) => [w.id as string, w.wod_date as string]));
  const { data: wodRes } = wodDate.size
    ? await supabase
        .from("results")
        .select("*, profiles!results_user_id_fkey(full_name, gender, avatar_url)")
        .in("wod_id", [...wodDate.keys()])
        .returns<(Result & { wod_id: string })[]>()
    : { data: [] as (Result & { wod_id: string })[] };
  const fromWods: PersonalRecord[] = (wodRes ?? []).map((r) => ({
    id: `wod-${r.id}`,
    user_id: r.user_id,
    benchmark_id: b.id,
    performed_on: wodDate.get(r.wod_id)!,
    division: r.division === "scaled" ? "scaled" : "rx",
    rm: 1,
    finished: r.finished,
    time_seconds: r.time_seconds,
    rounds: r.rounds,
    reps: r.reps,
    value: r.value,
    notes: r.notes,
    profiles: r.profiles ?? null,
  }));
  const fromWodHref = new Map((wodRes ?? []).map((r) => [`wod-${r.id}`, dayHref(wodDate.get(r.wod_id)!, { w: r.wod_id })]));
  const records = [...(all ?? []), ...fromWods];
  const mine = records.filter((r) => r.user_id === user.id).sort((x, y) => (x.performed_on < y.performed_on ? 1 : -1));
  const sameRM = (r: PersonalRecord) => !isRM || (r.rm ?? 1) === rm;

  // Ranking: la mejor marca de cada atleta (RX por delante de escalado)
  const bestByUser = new Map<string, PersonalRecord>();
  for (const r of records.filter(sameRM)) {
    if (gender !== "all" && r.profiles?.gender !== gender) continue;
    const cur = bestByUser.get(r.user_id);
    if (!cur || comparePR(b, r, cur) < 0) bestByUser.set(r.user_id, r);
  }
  const ranking = [...bestByUser.values()].sort((x, y) => comparePR(b, x, y));
  const myBest = [...mine.filter(sameRM)].sort((x, y) => comparePR(b, x, y))[0];
  // Percentil en la comunidad: posición de tu mejor marca entre la mejor de cada atleta (con el filtro actual)
  const myPos = myBest ? ranking.findIndex((r) => r.user_id === user.id) : -1;
  const beatPct = myPos >= 0 && ranking.length > 1 ? Math.round(((ranking.length - 1 - myPos) / (ranking.length - 1)) * 100) : null;
  // Porcentajes de tu RM para programar series (1RM real o estimado con Epley si apuntaste 3RM, 5RM…)
  const bestAnyRM = isRM ? [...mine].sort((x, y) => epley(y) - epley(x))[0] : undefined;
  const oneRM = bestAnyRM ? epley(bestAnyRM) : null;
  // Progreso: tus intentos en RX (con el mismo RM), para la gráfica
  const metric = (r: PersonalRecord): number | null => {
    if (b.score_type === "for_time") return r.finished !== false && r.time_seconds ? r.time_seconds : null;
    if (b.score_type === "amrap") return r.rounds != null ? r.rounds + (r.reps ?? 0) / 100 : null;
    return r.value != null ? Number(r.value) : null;
  };
  const progress: ProgressPoint[] = mine
    .filter((r) => sameRM(r) && r.division === "rx")
    .map((r) => ({ date: r.performed_on, v: metric(r), label: formatPR(b, r) }))
    .filter((p): p is ProgressPoint => p.v != null);
  const fmtDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const href = (o: { rm?: number; g?: string }) => {
    const u = new URLSearchParams();
    const r = o.rm ?? rm;
    if (isRM && r && r !== 1) u.set("rm", String(r));
    const g = o.g ?? gender;
    if (g !== "all") u.set("g", g);
    const s = u.toString();
    return `/marcas/${b.id}${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <Link href={`/marcas?c=${b.category}`} className="text-sm text-muted">← {cat ? `${cat.emoji} ${t(cat.label)}` : t("Mis marcas")}</Link>
      <div>
        <h1 className="h-title text-5xl">{b.name}</h1>
        {b.description && <p className="mt-2 whitespace-pre-line text-muted">{b.description}</p>}
      </div>

      {isRM && (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 5, 10].map((n) => (
            <Link key={n} href={href({ rm: n })} replace scroll={false} className={`chip ${rm === n ? "chip-on" : ""}`}>
              {n}RM
            </Link>
          ))}
        </div>
      )}

      <div className="card flex items-center justify-between p-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted">{t("Tu PR")}{isRM ? ` · ${rm}RM` : ""}</div>
          <div className="h-display text-4xl text-accent">{myBest ? formatPR(b, myBest) : "—"}</div>
        </div>
        {myBest && (
          <div className="text-right text-sm text-muted">
            {myBest.division === "scaled" && <div>{t("Escalado")}</div>}
            <Icon name="calendar" size={14} /> {fmtDate(myBest.performed_on)}
          </div>
        )}
      </div>

      {myPos >= 0 && ranking.length > 1 && (
        <PercentileCard
          rank={myPos + 1}
          total={ranking.length}
          labels={{
            pos: t("{pos}º de {n}", { pos: myPos + 1, n: ranking.length }),
            top: t("Superas al {beat}% de los atletas que lo han apuntado.", { beat: beatPct ?? 0 }),
            few: t("Tu posición en la comunidad. El percentil sale a partir de {min} atletas.", { min: MIN_FOR_PERCENTILE }),
          }}
        />
      )}

      {oneRM != null && oneRM > 0 && (
        <details className="space-y-2">
          <summary className="card flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
            <span className="flex flex-wrap items-center gap-2">
              <Icon name="plates" size={20} /> {t("Porcentajes y discos")} · 1RM {round05(oneRM)} kg
              {(bestAnyRM?.rm ?? 1) > 1 && <span className="ml-1 text-xs font-normal text-muted">{t("(estimado desde tu {rm}RM)", { rm: bestAnyRM?.rm ?? 1 })}</span>}
            </span>
            <span className="text-muted">▾</span>
          </summary>
          <PlateCalc oneRM={round05(oneRM)} />
        </details>
      )}

      <ProgressChart points={progress} lowerIsBetter={b.score_type === "for_time"} locale={locale} title={`${t("Tu progreso")}${isRM ? ` · ${rm}RM` : ""}`} prLabel="PR" />

      <PRForm benchmark={b} today={todayISO()} />

      {mine.length > 0 && (
        <section className="space-y-2">
          <h2 className="h-display text-2xl">{t("Tu historial")}</h2>
          <ul className="card divide-y divide-line">
            {mine.map((r) => (
              <li key={r.id} className="px-4 py-3">
               <div className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-xs text-muted">{fmtDate(r.performed_on)}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold tabular-nums">
                    {formatPR(b, r)}
                    {isRM && <span className="ml-1 text-xs text-muted">{r.rm ?? 1}RM</span>}
                    {r.id === myBest?.id && <span className="ml-2 text-xs text-accent">★ PR</span>}
                  </div>
                  {(r.notes || r.division === "scaled") && (
                    <div className="truncate text-xs text-muted">
                      {r.division === "scaled" ? `${t("Escalado")}${r.notes ? " · " : ""}` : ""}
                      {r.notes}
                    </div>
                  )}
                </div>
                {fromWodHref.has(r.id) ? (
                  <Link href={fromWodHref.get(r.id)!} className="text-xs text-muted underline">
                    {t("WOD")}
                  </Link>
                ) : (
                  <form action={deletePersonalRecord}>
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmDelete />
                  </form>
                )}
               </div>
                {!fromWodHref.has(r.id) && (
                  <details className="group">
                    <summary className="mt-1 cursor-pointer list-none text-xs text-muted underline"><Icon name="pencil" size={12} /> {t("Editar")}</summary>
                    <PRForm benchmark={b} today={todayISO()} record={r} />
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="h-display text-2xl">{t("Ranking de la comunidad")}</h2>
        <div className="flex gap-2">
          {[
            { value: "all", label: "Absoluto" },
            { value: "M", label: "Chicos" },
            { value: "F", label: "Chicas" },
          ].map((g) => (
            <Link key={g.value} href={href({ g: g.value })} replace scroll={false} className={`chip ${gender === g.value ? "chip-on" : ""}`}>
              {t(g.label)}
            </Link>
          ))}
        </div>
        {ranking.length === 0 ? (
          <p className="card p-5 text-sm text-muted">{t("Nadie ha apuntado esta marca todavía. ¡Sé el primero!")}</p>
        ) : (
          <ol className="card divide-y divide-line">
            {ranking.map((r, i) => {
              const me = r.user_id === user.id;
              return (
                <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${me ? "bg-accent/10" : ""}`}>
                  <span className={`marker w-7 ${i < 3 ? "text-accent" : "text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <Avatar name={r.profiles?.full_name} url={r.profiles?.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/atleta/${r.user_id}`} className="block truncate font-semibold">
                      {r.profiles?.full_name || t("Sin nombre")}
                      {me && <span className="ml-1 text-xs text-accent">{t("(tú)")}</span>}
                    </Link>
                    <div className="text-xs text-muted">
                      {r.division === "scaled" ? `${t("Escalado")} · ` : ""}
                      {fmtDate(r.performed_on)}
                    </div>
                  </div>
                  <div className="h-display text-xl tabular-nums">{formatPR(b, r)}</div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {isCoachProfile(profile) && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted"><span className="inline-flex items-center gap-1.5"><Icon name="pencil" size={14} /> {t("Editar este benchmark (coaches)")}</span></summary>
          <BenchmarkForm benchmark={b} />
          <form action={deleteBenchmark} className="text-right">
            <input type="hidden" name="id" value={b.id} />
            <ConfirmDelete label={t("Borrar benchmark")} confirmLabel={t("¿Seguro? Se borran también las marcas apuntadas")} />
          </form>
        </details>
      )}
    </div>
  );
}
