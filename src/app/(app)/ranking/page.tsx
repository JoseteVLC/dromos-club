import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { memberSince, requireUser } from "@/lib/supabase/server";
import { addDays, dayHref, dayLabel, isISODate, todayISO } from "@/lib/dates";
import { rankResults } from "@/lib/scoring";
import { mondayOf } from "@/lib/week-parser";
import { computeStandings } from "@/lib/ranking";
import { streakStandings } from "@/lib/streak-data";
import type { Gender, Result, Wod } from "@/lib/types";
import { getI18n } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/core";

type Period = "week" | "month" | "year";

function periodRange(period: Period, ref: string) {
  if (period === "week") {
    const start = mondayOf(ref);
    return { start, end: addDays(start, 6), prev: addDays(start, -7), next: addDays(start, 7) };
  }
  const [y, m] = ref.split("-").map(Number);
  const iso = (yy: number, mm: number, dd: number) =>
    new Date(Date.UTC(yy, mm - 1, dd, 12)).toISOString().slice(0, 10);
  if (period === "year") return { start: `${y}-01-01`, end: `${y}-12-31`, prev: `${y - 1}-01-01`, next: `${y + 1}-01-01` };
  return { start: iso(y, m, 1), end: iso(y, m + 1, 0), prev: iso(y, m - 1, 1), next: iso(y, m + 1, 1) };
}

function periodLabel(period: Period, start: string, end: string, locale: string) {
  const f = (d: string, o: Intl.DateTimeFormatOptions) =>
    new Date(d + "T12:00:00Z").toLocaleDateString(locale, { ...o, timeZone: "UTC" });
  if (period === "year") return start.slice(0, 4);
  if (period === "month") return f(start, { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
  return `${f(start, { day: "numeric", month: "short" })} – ${f(end, { day: "numeric", month: "short" })}`;
}

type Mode = "points" | "racha" | "lb";
function ModeTabs({ mode, t }: { mode: Mode; t: T }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/ranking" replace className={`chip ${mode === "points" ? "chip-on" : ""}`}>🏆 {t("Puntos")}</Link>
      <Link href="/ranking?p=racha" replace className={`chip ${mode === "racha" ? "chip-on" : ""}`}>🔥 {t("Constancia")}</Link>
      <Link href="/ranking?p=lb" replace className={`chip ${mode === "lb" ? "chip-on" : ""}`}>📋 {t("Leaderboards")}</Link>
    </div>
  );
}

/** Resultados de los WODs publicados entre dos fechas (paginado: un año puede pasar de 1.000 filas). */
async function resultsBetween(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], start: string, end: string) {
  const out: Result[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("results")
      .select("*, profiles!results_user_id_fkey(full_name, gender, avatar_url), wods!inner(wod_date, published)")
      .gte("wods.wod_date", start)
      .lte("wods.wod_date", end)
      .eq("wods.published", true)
      .order("id")
      .range(from, from + 999)
      .returns<Result[]>();
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Lista de los leaderboards de cada WOD del periodo, por fecha; cada uno lleva a su leaderboard. */
async function WodBoards({ period, refDate }: { period: Period; refDate: string }) {
  const { supabase, user, profile } = await requireUser();
  const since = memberSince(profile);
  const { t, locale } = await getI18n();
  const today = todayISO();
  const { start, end, prev, next } = periodRange(period, refDate);
  const current = periodRange(period, today).start === start;
  const { data: wodsData } = await supabase
    .from("wods")
    .select("*")
    .eq("published", true)
    .gte("wod_date", start)
    .lte("wod_date", end)
    .order("wod_date", { ascending: false })
    .order("part")
    .returns<Wod[]>();
  // Atletas nuevos: solo los WODs desde su alta
  const wods = (wodsData ?? []).filter((w) => !since || w.wod_date >= since);
  const results = wods.length ? await resultsBetween(supabase, since && since > start ? since : start, end) : [];
  const byWod = new Map<string, Result[]>();
  for (const r of results) byWod.set(r.wod_id, [...(byWod.get(r.wod_id) ?? []), r]);
  const dates = [...new Set(wods.map((w) => w.wod_date))];
  const href = (o: { p?: Period; ref?: string }) => {
    const q = new URLSearchParams({ p: "lb" });
    const pp = o.p ?? period;
    if (pp !== "week") q.set("per", pp);
    const rr = o.ref ?? refDate;
    if (rr !== today) q.set("ref", rr);
    return `/ranking?${q}`;
  };

  return (
    <div className="space-y-5">
      <h1 className="h-title text-5xl">Ranking</h1>
      <ModeTabs mode="lb" t={t} />
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-line p-1">
        {(["week", "month", "year"] as const).map((pp) => (
          <Link
            key={pp}
            href={href({ p: pp, ref: today })}
            replace
            className={`rounded-md py-2 text-center font-display text-lg font-bold uppercase ${period === pp ? "bg-accent text-accent-fg" : "text-muted"}`}
          >
            {pp === "week" ? t("Semana") : pp === "month" ? t("Mes") : t("Año")}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Link href={href({ ref: prev })} replace className="btn-ghost h-11 w-11 text-xl" aria-label={t("Anterior")}>‹</Link>
        <div className="flex h-11 flex-1 items-center justify-center rounded-lg border border-line">
          <span className="h-display text-2xl">{periodLabel(period, start, end, locale)}</span>
        </div>
        <Link href={href({ ref: next })} replace className="btn-ghost h-11 w-11 text-xl" aria-label={t("Siguiente")}>›</Link>
      </div>
      {!current && (
        <Link href={href({ ref: today })} replace className="block text-right text-xs font-semibold text-accent">
          {period === "week" ? t("Ir a esta semana") : period === "month" ? t("Ir a este mes") : t("Ir a este año")}
        </Link>
      )}
      {wods.length === 0 ? (
        <p className="card p-6 text-center text-muted">{t("No hay WODs en este periodo.")}</p>
      ) : (
        <div className="space-y-4">
          {dates.map((d) => (
            <div key={d} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">{dayLabel(d, today, t, locale)}</h3>
              <ul className="card divide-y divide-line">
                {wods
                  .filter((w) => w.wod_date === d)
                  .map((w) => {
                    const res = byWod.get(w.id) ?? [];
                    const top = rankResults(w, res)[0];
                    const mine = res.find((r) => r.user_id === user.id);
                    const myPos = mine && mine.division !== "scaled" ? rankResults(w, res).find((r) => r.id === mine.id)?.rank : null;
                    return (
                      <li key={w.id}>
                        <Link href={dayHref(w.wod_date, { w: w.id }) + "#leaderboard"} className="flex items-center gap-3 px-4 py-3 hover:bg-line/40">
                          <span className="marker w-6 text-accent">{w.part}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold">
                              {w.title}
                              {w.is_benchmark && " ★"}
                            </div>
                            <div className="truncate text-xs text-muted">
                              {res.length === 1 ? t("1 resultado") : t("{n} resultados", { n: res.length })}
                              {top && ` · 🥇 ${top.profiles?.full_name || t("Sin nombre")} ${top.display}`}
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            {mine ? (
                              <span className="font-semibold text-accent">{myPos ? t("{rank}º", { rank: myPos }) : "✓"}</span>
                            ) : (
                              <span className="text-muted">›</span>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function StreakRanking({ gender }: { gender: Gender | "all" }) {
  const { supabase, user } = await requireUser();
  const { t } = await getI18n();
  const rows = (await streakStandings(supabase)).filter((r) => gender === "all" || r.gender === gender);
  // Recalcula posiciones dentro del filtro
  const ranked = rows.map((r, i, a) => ({
    ...r,
    rank: i > 0 && a[i - 1].current === r.current && a[i - 1].best === r.best && a[i - 1].total === r.total ? -1 : i + 1,
  }));
  for (let i = 0; i < ranked.length; i++) if (ranked[i].rank === -1) ranked[i].rank = ranked[i - 1].rank;
  const gq = (g: string) => `/ranking?p=racha${g !== "all" ? `&g=${g}` : ""}`;

  return (
    <div className="space-y-5">
      <h1 className="h-title text-5xl">Ranking</h1>
      <ModeTabs mode="racha" t={t} />
      <div className="flex gap-2">
        {[
          { value: "all", label: "Absoluto" },
          { value: "M", label: "Chicos" },
          { value: "F", label: "Chicas" },
        ].map((g) => (
          <Link key={g.value} href={gq(g.value)} replace className={`chip ${gender === g.value ? "chip-on" : ""}`}>
            {t(g.label)}
          </Link>
        ))}
      </div>
      {ranked.length === 0 ? (
        <p className="card p-6 text-center text-muted">{t("Todavía nadie ha empezado su racha.")}</p>
      ) : (
        <ol className="card divide-y divide-line overflow-hidden">
          {ranked.map((s) => {
            const me = s.user_id === user.id;
            return (
              <li key={s.user_id} className={`flex items-center gap-3 px-4 py-3 ${me ? "bg-accent/10" : ""}`}>
                <span className={`marker w-7 ${s.rank <= 3 ? "text-accent" : "text-muted"}`}>{String(s.rank).padStart(2, "0")}</span>
                <Avatar name={s.name} url={s.avatar_url} size={34} />
                <div className="min-w-0 flex-1">
                  <Link href={`/atleta/${s.user_id}`} className="block truncate font-semibold">
                    {s.name === "Sin nombre" ? t("Sin nombre") : s.name}
                    {me && <span className="ml-1 text-xs text-accent">{t("(tú)")}</span>}
                  </Link>
                  <div className="text-xs text-muted">
                    {t("Récord")} {s.best} · {s.total === 1 ? t("1 día en total") : t("{n} días en total", { n: s.total })}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`h-display text-2xl tabular-nums ${s.current === 0 ? "text-muted" : ""}`}>
                    {s.current > 0 && "🔥"}
                    {s.current}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">{t("seguidos")}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs leading-relaxed text-muted">
        {t("Cuenta los días de WOD seguidos en los que has metido tu resultado. Los días sin WOD no rompen la racha, y hoy no cuenta como fallo hasta que acaba el día.")}
      </p>
    </div>
  );
}

export default async function RankingPage({ searchParams }: PageProps<"/ranking">) {
  const sp = await searchParams;
  if (sp.p === "racha") {
    const g = (["M", "F"].includes(String(sp.g)) ? sp.g : "all") as Gender | "all";
    return <StreakRanking gender={g} />;
  }
  if (sp.p === "lb") {
    const per: Period = sp.per === "month" ? "month" : sp.per === "year" ? "year" : "week";
    const refLb = isISODate(String(sp.ref)) ? String(sp.ref) : todayISO();
    return <WodBoards period={per} refDate={refLb} />;
  }
  const period: Period = sp.p === "month" ? "month" : sp.p === "year" ? "year" : "week";
  const today = todayISO();
  const ref = isISODate(String(sp.ref)) ? String(sp.ref) : today;
  const gender = (["M", "F"].includes(String(sp.g)) ? sp.g : "all") as Gender | "all";
  const { start, end, prev, next } = periodRange(period, ref);
  const current = periodRange(period, today).start === start;
  const { t, locale } = await getI18n();

  const { supabase, user } = await requireUser();
  const { data: wodsData } = await supabase
    .from("wods")
    .select("*")
    .eq("published", true)
    .gte("wod_date", start)
    .lte("wod_date", end)
    .returns<Wod[]>();
  const wods = wodsData ?? [];
  const resData = wods.length ? await resultsBetween(supabase, start, end) : [];
  const standings = computeStandings(wods, resData, gender);

  const href = (o: { p?: Period; ref?: string; g?: string }) => {
    const q = new URLSearchParams();
    const p = o.p ?? period;
    if (p !== "week") q.set("p", p);
    const r = o.ref ?? ref;
    if (r !== today) q.set("ref", r);
    const g = o.g ?? gender;
    if (g !== "all") q.set("g", g);
    const s = q.toString();
    return `/ranking${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <h1 className="h-title text-5xl">Ranking</h1>
      <ModeTabs mode="points" t={t} />

      <div className="grid grid-cols-3 gap-1 rounded-lg border border-line p-1">
        {(["week", "month", "year"] as const).map((p) => (
          <Link
            key={p}
            href={href({ p, ref: today })}
            replace
            className={`rounded-md py-2 text-center font-display text-lg font-bold uppercase ${period === p ? "bg-accent text-accent-fg" : "text-muted"}`}
          >
            {p === "week" ? t("Semana") : p === "month" ? t("Mes") : t("Año")}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link href={href({ ref: prev })} replace className="btn-ghost h-11 w-11 text-xl" aria-label={t("Anterior")}>‹</Link>
        <div className="flex h-11 flex-1 items-center justify-center rounded-lg border border-line">
          <span className="h-display text-2xl">{periodLabel(period, start, end, locale)}</span>
        </div>
        <Link href={href({ ref: next })} replace className="btn-ghost h-11 w-11 text-xl" aria-label={t("Siguiente")}>›</Link>
      </div>
      {!current && (
        <Link href={href({ ref: today })} replace className="block text-right text-xs font-semibold text-accent">
          {period === "week" ? t("Ir a esta semana") : period === "month" ? t("Ir a este mes") : t("Ir a este año")}
        </Link>
      )}

      <div className="flex gap-2">
        {[
          { value: "all", label: "Absoluto" },
          { value: "M", label: "Chicos" },
          { value: "F", label: "Chicas" },
        ].map((g) => (
          <Link key={g.value} href={href({ g: g.value })} replace className={`chip ${gender === g.value ? "chip-on" : ""}`}>
            {t(g.label)}
          </Link>
        ))}
      </div>

      {standings.length === 0 ? (
        <p className="card p-6 text-center text-muted">{t("Todavía no hay resultados en este periodo.")}</p>
      ) : (
        <ol className="card divide-y divide-line overflow-hidden">
          {standings.map((s) => {
            const me = s.user_id === user.id;
            return (
              <li key={s.user_id} className={`flex items-center gap-3 px-4 py-3 ${me ? "bg-accent/10" : ""}`}>
                <span className={`marker w-7 ${s.rank <= 3 ? "text-accent" : "text-muted"}`}>{String(s.rank).padStart(2, "0")}</span>
                <Avatar name={s.name} url={s.avatar_url} size={34} />
                <div className="min-w-0 flex-1">
                  <Link href={`/atleta/${s.user_id}`} className="block truncate font-semibold">
                    {s.name === "Sin nombre" ? t("Sin nombre") : s.name}
                    {me && <span className="ml-1 text-xs text-accent">{t("(tú)")}</span>}
                  </Link>
                  <div className="text-xs text-muted">
                    {s.wods} {s.wods === 1 ? "WOD" : "WODs"}
                    {s.podiums > 0 && ` · ${s.podiums === 1 ? t("1 podio") : t("{n} podios", { n: s.podiums })}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-display text-2xl tabular-nums">{s.points}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">{t("pts")}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-xs leading-relaxed text-muted">
        {t("En cada WOD sumas 1 punto por participar y 1 más por cada atleta que queda por detrás de ti (Elite > RX). Si lo haces escalado sumas 1 punto. Cuantos más WODs hagas, más sumas.")}
      </p>
    </div>
  );
}
