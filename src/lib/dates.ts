const TZ = "Europe/Madrid";

/** Fecha de hoy en Madrid como YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type TFn = (s: string) => string;
const id: TFn = (s) => s;

/** "Hoy", "Ayer", "Mañana" o "vie 13 nov". */
export function dayLabel(iso: string, today = todayISO(), t: TFn = id, locale = "es-ES"): string {
  if (iso === today) return t("Hoy");
  if (iso === addDays(today, -1)) return t("Ayer");
  if (iso === addDays(today, 1)) return t("Mañana");
  return new Date(iso + "T12:00:00Z").toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function longDate(iso: string, locale = "es-ES"): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function dayHref(iso: string, extra?: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(extra ?? {})) if (v) q.set(k, v);
  const s = q.toString();
  return `/d/${iso}${s ? `?${s}` : ""}`;
}
