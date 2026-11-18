import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askAi } from "./ai";
import { addDays } from "./dates";
import { mondayOf } from "./week-parser";
import { computeStandings } from "./ranking";
import { computeMedals } from "./achievements";
import { MEDALS } from "./medals";
import { sendPush } from "./push";
import type { Result, Wod } from "./types";

/**
 * Resumen semanal personal (domingo por la tarde, por push).
 * Entrenos de la semana, puesto en el ranking de puntos y cómo ha cambiado, PRs, medallas nuevas
 * y la medalla que tiene más cerca. La IA lo escribe en una frase con gancho; si no hay IA, plantilla.
 */
type Member = { user_id: string; box_id: string; boxes: { slug: string; name: string } };
type Stats = { name: string; box: string; days: number; rank: number | null; prevRank: number | null; total: number; prs: number; medals: string[]; next: { name: string; left: number } | null };

const SYSTEM = `Escribes la notificación del resumen semanal de una app de leaderboard de CrossFit. Con los datos, escribe en español UNA o DOS frases (máximo 150 caracteres en total), cercanas y motivadoras, tuteando, con 1 emoji como mucho. Menciona lo más destacable (PR, medalla, subida en el ranking o constancia) y, si hay, cuánto le falta para la próxima medalla. Si no ha entrenado, anímale a volver sin reñir. Responde solo con el texto.`;

function template(s: Stats): string {
  if (!s.days) return `Esta semana no has metido entrenos en ${s.box}. ¡La próxima es tuya!${s.next ? ` Te faltan ${s.next.left} para ${s.next.name}.` : ""}`;
  const parts = [`${s.days} ${s.days === 1 ? "entreno" : "entrenos"}`];
  if (s.rank) parts.push(`${s.rank}º en el ranking${s.prevRank && s.prevRank > s.rank ? ` (subes ${s.prevRank - s.rank})` : ""}`);
  if (s.prs) parts.push(`${s.prs} PR${s.prs > 1 ? "s" : ""}`);
  if (s.medals.length) parts.push(`medalla ${s.medals.join(", ")}`);
  return `${parts.join(" · ")}.${s.next ? ` Te faltan ${s.next.left} para ${s.next.name}.` : ""}`;
}

async function boxWeek(db: SupabaseClient, boxId: string, start: string, end: string) {
  const [{ data: wods }, { data: res }] = await Promise.all([
    db.from("wods").select("*").eq("box_id", boxId).eq("published", true).gte("wod_date", start).lte("wod_date", end).returns<Wod[]>(),
    db
      .from("results")
      .select("*, profiles!results_user_id_fkey(full_name, gender), wods!inner(wod_date)")
      .eq("box_id", boxId)
      .gte("wods.wod_date", start)
      .lte("wods.wod_date", end)
      .limit(20000)
      .returns<(Result & { wods: { wod_date: string } })[]>(),
  ]);
  return { wods: wods ?? [], res: res ?? [] };
}

export async function sendWeeklySummaries(db: SupabaseClient, today: string, userIds: string[]): Promise<number> {
  const start = mondayOf(today);
  const prevStart = addDays(start, -7);
  const [{ data: people }, { data: mems }] = await Promise.all([
    db.from("profiles").select("id, first_name, full_name").in("id", userIds).eq("active", true).eq("notify_weekly", true),
    db.from("box_members").select("user_id, box_id, boxes!inner(slug, name)").in("user_id", userIds).eq("active", true).eq("pending", false).returns<Member[]>(),
  ]);
  const person = new Map((people ?? []).map((p) => [p.id as string, p]));
  const byBox = new Map<string, Member[]>();
  for (const m of mems ?? []) if (person.has(m.user_id)) byBox.set(m.box_id, [...(byBox.get(m.box_id) ?? []), m]);

  const jobs: (() => Promise<boolean>)[] = [];
  const once = new Set<string>(); // un resumen por persona (si está en varios boxes, el primero con actividad)
  for (const [boxId, members] of byBox) {
    const [cur, prev] = await Promise.all([boxWeek(db, boxId, start, today), boxWeek(db, boxId, prevStart, addDays(start, -1))]);
    const rankNow = new Map(computeStandings(cur.wods, cur.res).map((s) => [s.user_id, s.rank]));
    const rankPrev = new Map(computeStandings(prev.wods, prev.res).map((s) => [s.user_id, s.rank]));
    const total = rankNow.size;
    const { data: newMedals } = await db.from("user_achievements").select("user_id, code").eq("box_id", boxId).gte("unlocked_on", start).lte("unlocked_on", today);
    const { data: prs } = await db.from("personal_records").select("user_id").in("user_id", members.map((m) => m.user_id)).gte("performed_on", start).lte("performed_on", today);

    for (const m of members) {
      const days = new Set(cur.res.filter((r) => r.user_id === m.user_id).map((r) => r.wods.wod_date)).size;
      const activeBefore = prev.res.some((r) => r.user_id === m.user_id);
      if ((!days && !activeBefore) || once.has(m.user_id)) continue; // sin actividad reciente: no molestamos
      if (days) once.add(m.user_id);
      jobs.push(async () => {
        const p = person.get(m.user_id)!;
        // La medalla más cercana (de las que se ganan acumulando)
        let next: Stats["next"] = null;
        try {
          const prog = await computeMedals(db, m.user_id, boxId);
          let best = 0;
          for (const g of prog) {
            const def = MEDALS.find((d) => d.code === g.code);
            if (!def || g.unlockedOn || def.target < 3 || def.group === "competicion") continue;
            const ratio = g.progress / def.target;
            if (ratio > best && def.target - g.progress <= 15) {
              best = ratio;
              next = { name: def.name, left: def.target - g.progress };
            }
          }
        } catch {}
        const s: Stats = {
          name: (p.first_name || p.full_name || "").split(" ")[0],
          box: m.boxes.name,
          days,
          rank: rankNow.get(m.user_id) ?? null,
          prevRank: rankPrev.get(m.user_id) ?? null,
          total,
          prs: (prs ?? []).filter((x) => x.user_id === m.user_id).length,
          medals: (newMedals ?? []).filter((x) => x.user_id === m.user_id).map((x) => MEDALS.find((d) => d.code === x.code)?.name ?? x.code),
          next,
        };
        const ai = await askAi(SYSTEM, JSON.stringify(s), 120);
        const body = (ai && ai.length <= 200 ? ai : template(s)).replace(/^["«]|["»]$/g, "");
        const n = await sendPush([m.user_id], "weekly", { title: `📊 Tu semana${s.name ? `, ${s.name}` : ""}`, body, url: "/ranking", tag: "weekly", box: m.boxes.slug });
        return n > 0;
      });
    }
  }
  // De 5 en 5 para no pasarnos del tiempo del cron
  let sent = 0;
  for (let i = 0; i < jobs.length; i += 5) sent += (await Promise.all(jobs.slice(i, i + 5).map((j) => j().catch(() => false)))).filter(Boolean).length;
  return sent;
}
