"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { addDays, dayHref as wodHref, dayLabel, fullDayHref, longDate } from "@/lib/dates";

/** «d»: pantalla de WODs (una parte); «dia»: día completo */
type Base = "d" | "dia";
const hrefOf = (base: Base) => (iso: string) => (base === "dia" ? fullDayHref(iso) : wodHref(iso));
import { useI18n } from "@/lib/i18n/client";

/** Barra de fecha: ‹ Hoy › + botón de calendario. */
export function DayNav({ date, today, min, max, base = "d" }: { date: string; today: string; min?: string | null; max?: string | null; base?: Base }) {
  const dayHref = hrefOf(base);
  const router = useRouter();
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const canPrev = !min || prev >= min;
  const canNext = !max || next <= max;

  // Precarga los días contiguos para que el cambio sea instantáneo
  useEffect(() => {
    if (canPrev) router.prefetch(dayHref(prev));
    if (canNext) router.prefetch(dayHref(next));
  }, [router, prev, next, canPrev, canNext, dayHref]);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {canPrev ? (
          <Link href={dayHref(prev)} className="btn-ghost h-11 w-11 text-xl" aria-label={t("Día anterior")}>
            ‹
          </Link>
        ) : (
          <span className="btn-ghost h-11 w-11 text-xl opacity-20" aria-hidden>
            ‹
          </span>
        )}
        <button
          type="button"
          onClick={openPicker}
          className="relative flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-line"
          aria-label={t("Elegir fecha")}
        >
          <span className="h-display text-3xl">{dayLabel(date, today, t, locale)}</span>
          <CalendarIcon />
          <input
            ref={inputRef}
            type="date"
            value={date}
            min={min ?? undefined}
            max={max ?? undefined}
            onChange={(e) => e.target.value && router.push(dayHref(e.target.value))}
            className="pointer-events-none absolute inset-0 opacity-0"
            tabIndex={-1}
            aria-hidden
          />
        </button>
        {canNext ? (
          <Link href={dayHref(next)} className="btn-ghost h-11 w-11 text-xl" aria-label={t("Día siguiente")}>
            ›
          </Link>
        ) : (
          <span className="btn-ghost h-11 w-11 text-xl opacity-20" aria-hidden>
            ›
          </span>
        )}
      </div>
      <div className="flex items-center justify-between px-1 text-xs text-muted">
        <span>{longDate(date, locale).replace(/^./, (c) => c.toUpperCase())}</span>
        {date !== today && (
          <Link href={dayHref(today)} className="font-semibold text-accent">
            {t("Ir a hoy")}
          </Link>
        )}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

/** Deslizar a izquierda/derecha para cambiar de día. */
export function SwipeDays({ date, min, max, base = "d", children }: { date: string; min?: string | null; max?: string | null; base?: Base; children: React.ReactNode }) {
  const dayHref = hrefOf(base);
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      onTouchStart={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, select, [data-noswipe]")) {
          start.current = null;
          return;
        }
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        if (!start.current) return;
        const dx = e.changedTouches[0].clientX - start.current.x;
        const dy = e.changedTouches[0].clientY - start.current.y;
        start.current = null;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) {
          const to = addDays(date, dx < 0 ? 1 : -1);
          if ((!min || to >= min) && (!max || to <= max)) router.push(dayHref(to));
        }
      }}
      className="min-h-[60vh]"
    >
      {children}
    </div>
  );
}
