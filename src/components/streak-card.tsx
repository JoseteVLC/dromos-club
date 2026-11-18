"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

type DayDot = { date: string; label: string; status: "done" | "missed" | "pending" | "rest"; isToday: boolean; selected: boolean };

const SEEN_KEY = "tc-streak-seen";

export function StreakCard({
  current,
  best,
  week,
  hint,
}: {
  current: number;
  best: number;
  week: DayDot[];
  hint?: string;
}) {
  const [party, setParty] = useState<{ n: number; record: boolean } | null>(null);
  const { t } = useI18n();

  // Celebración cuando la racha sube respecto a la última vez que la viste
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const seen = Number(localStorage.getItem(SEEN_KEY) ?? "-1");
        if (seen >= 0 && current > seen) setParty({ n: current, record: current >= best && current > 1 });
        localStorage.setItem(SEEN_KEY, String(current));
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, [current, best]);

  return (
    <>
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Flame lit={current > 0} />
          <div className="flex-1">
            <div className="h-display text-3xl">
              {current} {current === 1 ? t("día") : t("días")} <span className="text-muted">{t("seguidos")}</span>
            </div>
            <div className="text-xs text-muted">
              {t("Récord")}: <b className="text-fg">{best}</b> · <Link href="/ranking?p=racha" className="text-accent">{t("Ver constancia →")}</Link>
            </div>
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
    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-3xl ${lit ? "bg-accent/15" : "bg-line grayscale"}`}>
      🔥
    </div>
  );
}
