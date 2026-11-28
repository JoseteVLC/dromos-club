import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { syncMedals } from "@/lib/achievements";
import { LEVEL_STEPS, MEDALS, MEDAL_GROUPS, medalLevel, nextLevelAt } from "@/lib/medals";
import { MedalBadge } from "@/components/medal-badge";
import { RankingTabs } from "@/components/ranking-tabs";

export default async function MedallasPage({ searchParams }: PageProps<"/medallas">) {
  const fromRanking = (await searchParams).desde === "ranking";
  const { supabase, user, box } = await requireUser();
  if (box.competition) redirect("/perfil");
  const { t, locale } = await getI18n();
  const { progress, owned } = await syncMedals(supabase, user.id, box);
  const prog = new Map(progress.map((p) => [p.code, p]));
  const count = MEDALS.filter((m) => owned.has(m.code)).length;
  const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      {fromRanking ? (
        <RankingTabs mode="medals" t={t} />
      ) : (
        <Link href="/perfil" className="text-sm text-muted">‹ {t("Perfil")}</Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <h1 className="h-title text-5xl">{t("Medallas")}</h1>
        <div className="text-right">
          <div className="h-display text-4xl text-accent">
            {count}
            <span className="text-xl text-muted">/{MEDALS.length}</span>
          </div>
          <div className="text-xs text-muted">{t("desbloqueadas")}</div>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(count / MEDALS.length) * 100}%` }} />
      </div>
      <details className="card p-4 text-sm" open={count === 0}>
        <summary className="cursor-pointer font-semibold">{t("Cómo funcionan las medallas")}</summary>
        <ul className="mt-3 space-y-2 text-muted">
          <li>• {t("Se desbloquean solas al guardar tus resultados y tus marcas. Una vez ganadas son tuyas para siempre.")}</li>
          {box.rewards_enabled && <li>• {t("Las 🎁 llevan premio de tu box: cuando la desbloquees te lo harán llegar (revisa tu dirección en el perfil).")}</li>}
          <li>• {t("Las que llevan ↻ se pueden ganar muchas veces y evolucionan:")}</li>
        </ul>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          {LEVEL_STEPS.map((n, i) => (
            <div key={n} className="rounded-lg border border-line p-2">
              <div className="font-display text-lg font-bold text-accent">{t("Nivel {l}", { l: i + 1 })}</div>
              <div className="font-semibold">{n === 1 ? t("1 vez") : t("{n} veces", { n })}</div>
              <div className="text-muted">{[t("la medalla"), t("+ aro"), t("+ brillo"), t("+ corona")][i]}</div>
            </div>
          ))}
        </div>
      </details>

      {MEDAL_GROUPS.map((g) => (
        <section key={g.value} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{t(g.label)}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MEDALS.filter((m) => m.group === g.value).map((m) => {
              const date = owned.get(m.code) ?? null;
              const p = prog.get(m.code);
              const pct = Math.min(100, Math.round(((p?.progress ?? 0) / m.target) * 100));
              return (
                <li key={m.code} className="card space-y-2 p-3 text-center">
                  <MedalBadge medal={m} unlocked={!!date} size={92} times={p?.times ?? 0} />
                  <div className={`font-semibold leading-tight ${date ? "" : "text-muted"}`}>
                    {t(m.name)}
                    {m.reward && box.rewards_enabled && " 🎁"}
                    {m.repeat && <span className="ml-1 text-accent" title={t("Se puede volver a ganar")}>↻</span>}
                  </div>
                  <p className="text-xs text-muted">{t(m.desc)}</p>
                  {m.repeat && <LevelLadder times={date ? (p?.times ?? 1) : 0} t={t} />}
                  {date && m.repeat && (p?.times ?? 0) > 1 ? (
                    <div className="space-y-0.5 text-xs">
                      <div className="font-semibold text-accent">
                        {t("Nivel {l}", { l: medalLevel(p!.times) })} · {t("{n} veces", { n: p!.times })}
                      </div>
                      {nextLevelAt(p!.times) && (
                        <div className="text-[11px] text-muted">{t("Nivel {l} a las {n}", { l: medalLevel(p!.times) + 1, n: nextLevelAt(p!.times)! })}</div>
                      )}
                    </div>
                  ) : date ? (
                    <div className="space-y-0.5 text-xs">
                      <div className="font-semibold text-accent">✓ {fmt(date)}</div>
                      {m.repeat && <div className="text-[11px] text-muted">{t("Se puede volver a ganar")}</div>}
                    </div>
                  ) : m.target > 1 ? (
                    <div className="space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[11px] tabular-nums text-muted">
                        {Math.min(p?.progress ?? 0, m.target)}/{m.target}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted">{t("Por desbloquear")}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Los 4 niveles de una medalla que se repite (1, 3, 5 y 10 veces) con los que ya tienes marcados */
function LevelLadder({ times, t }: { times: number; t: (k: string, v?: Record<string, string | number>) => string }) {
  const lvl = medalLevel(times);
  return (
    <div className="space-y-1">
      <div className="flex justify-center gap-1" aria-label={t("Nivel {l} de 4", { l: lvl })}>
        {LEVEL_STEPS.map((n, i) => (
          <span
            key={n}
            className={`flex h-6 min-w-6 items-center justify-center rounded px-1 text-[11px] font-bold tabular-nums ${i < lvl ? "bg-accent text-accent-fg" : "border border-line text-muted"}`}
            title={t("Nivel {l} a las {n}", { l: i + 1, n })}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="text-[11px] text-muted">{lvl ? t("Nivel {l} de 4", { l: lvl }) : t("4 niveles: 1, 3, 5 y 10 veces")}</div>
    </div>
  );
}
