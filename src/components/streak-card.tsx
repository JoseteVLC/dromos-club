"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { Icon } from "@/components/icon";

type DayDot = { date: string; label: string; status: "done" | "missed" | "pending" | "rest"; isToday: boolean; selected: boolean };

const SEEN_KEY = "tc-streak-seen";

export function StreakCard({
  days,
  bestDays,
  current,
  best,
  week,
  goal,
  hint,
}: {
  /** Días seguidos y su récord */
  days: number;
  bestDays: number;
  /** Semanas seguidas de 5 días y su récord */
  current: number;
  best: number;
  week: DayDot[];
  /** Días que hay que entrenar esta semana para que cuente (5, o menos si la semana tiene menos plani) */
  goal: number;
  hint?: string;
}) {
  const [party, setParty] = useState<{ n: number; record: boolean } | null>(null);
  const { t } = useI18n();
  const doneWeek = week.filter((d) => d.status === "done").length;

  // Celebración cuando la racha sube respecto a la última vez que la viste
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const seen = Number(localStorage.getItem(SEEN_KEY) ?? "-1");
        if (seen >= 0 && days > seen) setParty({ n: days, record: days >= bestDays && days > 1 });
        localStorage.setItem(SEEN_KEY, String(days));
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, [days, bestDays]);

  return (
    <>
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Flame lit={days > 0} />
          <div className="flex-1">
            <div className="h-display text-3xl">
              {days} {days === 1 ? t("día") : t("días")} <span className="text-muted">{t("seguidos")}</span>
            </div>
            <div className="text-xs text-muted">
              {t("Récord")}: <b className="text-fg">{bestDays}</b> · <Link href="/ranking?p=racha" className="text-accent">{t("Ver constancia →")}</Link>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {t("Semanas de 5 días")}: <b className="text-fg">{current}</b> {current === 1 ? t("seguida") : t("seguidas")}
              {best > current ? <span> · {t("récord")} {best}</span> : null}
            </span>
            <b className={doneWeek >= goal ? "text-accent" : "text-fg"}>
              {doneWeek >= goal ? `✓ ${t("Semana cumplida")}` : t("esta semana {n} de {g}", { n: doneWeek, g: goal })}
            </b>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (doneWeek / Math.max(1, goal)) * 100)}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {week.map((d) => (
            <Link key={d.date} href={`/d/${d.date}`} replace className="space-y-1">
              <div className={`text-[11px] font-semibold uppercase ${d.isToday ? "text-accent" : "text-muted"}`}>{d.label}</div>
              <div
                className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  d.status === "done"
                    ? "bg-accent text-accent-fg"
                    : d.status === "missed"
                      ? "border border-line text-muted/60"
                      : d.status === "pending"
                        ? "border-2 border-dashed border-accent/60"
                        : "text-muted/40"
                } ${d.selected ? "ring-2 ring-fg ring-offset-2 ring-offset-card" : ""}`}
              >
                {d.status === "done" ? "✓" : d.status === "missed" ? "✕" : d.status === "rest" ? "–" : ""}
              </div>
            </Link>
          ))}
        </div>

        {hint && <p className="text-center text-xs text-muted">{hint}</p>}
      </div>

      {party && (
        <button
          type="button"
          onClick={() => setParty(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg/90 p-8 text-center backdrop-blur-sm"
          style={{ animation: "tc-pop .35s ease-out" }}
        >
          <div className="text-8xl" style={{ animation: "tc-flame 1s ease-in-out infinite alternate" }}>
            🔥
          </div>
          <div className="h-display text-7xl text-accent">{party.n}</div>
          <div className="h-display text-3xl">{party.n === 1 ? t("¡Primer día!") : t("días seguidos")}</div>
          {party.record && <div className="rounded-full bg-accent px-4 py-1 font-display text-lg font-bold uppercase text-accent-fg">{t("¡Nuevo récord!")}</div>}
          <p className="max-w-xs text-sm text-muted">{t(cheer(party.n))}</p>
          <span className="mt-4 text-xs text-muted">{t("Toca para seguir")}</span>
        </button>
      )}
    </>
  );
}

function cheer(n: number) {
  if (n === 1) return "Empieza la racha. Mañana, otra.";
  if (n < 5) return "Esto va cogiendo forma. No la rompas.";
  if (n < 10) return "Constancia de la buena. Cada día suma.";
  if (n < 20) return "Eso ya no es suerte, es disciplina.";
  return "Nivel culto. Sigue así.";
}

function Flame({ lit }: { lit: boolean }) {
  return (
    <div className={lit ? "" : "opacity-40 grayscale"}>
      <Icon name="flame" size={34} tile />
    </div>
  );
}
