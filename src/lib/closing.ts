import { addDays } from "./dates";

/**
 * Cierre del leaderboard para las medallas de competición (Podio, Campeón, Dinastía).
 * El WOD del día D se puede meter con margen hasta el final del día D+2 (hora de Madrid).
 * Solo cuentan los resultados metidos antes del cierre; los que llegan tarde salen en el ranking
 * pero no dan ni quitan medallas.
 */
export const CLOSE_DAYS = 2;

/** Día en que cierra (el último día en que aún cuenta). */
export function closeDay(wodDate: string): string {
  return addDays(wodDate, CLOSE_DAYS);
}

/** Medianoche de Madrid al empezar el día `iso`, como instante UTC. */
function madridMidnight(iso: string): Date {
  const utc = new Date(`${iso}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).formatToParts(utc);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0); // 1 en invierno, 2 en verano
  return new Date(utc.getTime() - h * 3600_000);
}

/** Instante exacto del cierre: 00:00 de Madrid del día siguiente a closeDay. */
export function closesAt(wodDate: string): Date {
  return madridMidnight(addDays(wodDate, CLOSE_DAYS + 1));
}

export function isClosed(wodDate: string, now = new Date()): boolean {
  return now.getTime() >= closesAt(wodDate).getTime();
}

/** ¿Ese resultado llegó a tiempo para contar en las medallas? */
export function inTime(wodDate: string, createdAt: string | null | undefined): boolean {
  if (!createdAt) return true;
  return Date.parse(createdAt) < closesAt(wodDate).getTime();
}
