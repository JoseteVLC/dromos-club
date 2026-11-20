import { NextResponse } from "next/server";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";
import { sendPush, staffIds } from "@/lib/push";
import { addDays, todayISO } from "@/lib/dates";
import { syncMedalsForClosedWods } from "@/lib/achievements";
import { sendWeeklySummaries } from "@/lib/weekly";
import { computeStreak, weekOf, WEEK_GOAL } from "@/lib/streaks";
import { boxStats } from "@/lib/box-stats";

/**
 * Recordatorios diarios (Vercel Cron, a última hora de la tarde). Solo a quien tiene push y los recordatorios activados:
 *  · Racha en peligro: lleva 1+ semanas seguidas y, si no entrena hoy, ya no llega a los 5 días de esta semana;
 *    o lleva 3+ días seguidos, hoy hay plani y aún no ha metido resultado.
 *  · Lunes: aviso al equipo de cuántos atletas están en riesgo de dejarlo (panel del box).
 *  · Te echamos de menos: lleva 3+ días de plani sin meter resultado (como mucho un aviso cada 4 días).
 *  · Primer resultado: se dio de alta hace 2+ días y aún no ha metido ninguno (una sola vez).
 * Antes, reparte las medallas de competición (Podio, Campeón, Dinastía) de los WODs que han cerrado.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAdminKey()) return NextResponse.json({ error: "no admin key" }, { status: 500 });
  const db = adminDb();
  const today = todayISO();
  const since = addDays(today, -45);
  const weekStart = weekOf(today);
  const weekEnd = addDays(weekStart, 6);

  let medalUsers = 0;
  try {
    medalUsers = await syncMedalsForClosedWods(db, today);
  } catch {
    // si falla, que no impida los recordatorios
  }

  // Lunes: a coaches y admins de cada box, cuántos atletas están en riesgo de dejarlo
  let riskBoxes = 0;
  if (new Date(today + "T12:00:00Z").getUTCDay() === 1) {
    const { data: boxes } = await db.from("boxes").select("id, slug");
    for (const b of boxes ?? []) {
      try {
        const st = await boxStats(db, today, b.id as string);
        const n = st.atRisk.length;
        if (!n) continue;
        await sendPush(await staffIds(b.id as string), "messages", {
          title: `⚠️ ${n} ${n === 1 ? "atleta en riesgo" : "atletas en riesgo"} de dejarlo`,
          body: "Llevan días sin entrenar. Un mensaje vuestro suele bastar: míralo en el panel del box.",
          url: "/coach/panel",
          tag: "risk",
          box: b.slug as string,
        });
        riskBoxes++;
      } catch (e) {
        console.error("risk", b.slug, e);
      }
    }
  }

  const { data: subs } = await db.from("push_subscriptions").select("user_id");
  const ids = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  if (!ids.length) return NextResponse.json({ sent: 0, medalUsers, riskBoxes });

  // Domingo: resumen semanal personal (en vez de los recordatorios, para no mandar dos avisos)
  if (new Date(today + "T12:00:00Z").getUTCDay() === 0) {
    const weekly = await sendWeeklySummaries(db, today, ids).catch((e) => {
      console.error("weekly", e);
      return 0;
    });
    return NextResponse.json({ weekly, medalUsers, riskBoxes });
  }

  type Mem = { user_id: string; box_id: string; joined_at: string; boxes: { slug: string; name: string; competition: boolean } };
  const [{ data: people }, { data: mems }, { data: wods }, { data: res }] = await Promise.all([
    db.from("profiles").select("id, first_name, full_name, last_reminder_at").in("id", ids).eq("active", true).eq("notify_reminders", true),
    db.from("box_members").select("user_id, box_id, joined_at, boxes!inner(slug, name, competition)").in("user_id", ids).eq("active", true).returns<Mem[]>(),
    db.from("wods").select("box_id, wod_date").eq("published", true).gte("wod_date", since).lte("wod_date", weekEnd),
    db.from("results").select("user_id, box_id, wods!inner(wod_date)").in("user_id", ids).gte("wods.wod_date", since).returns<{ user_id: string; box_id: string; wods: { wod_date: string } }[]>(),
  ]);
  // Días de plani y días entrenados, por box
  const daysOf = new Map<string, string[]>();
  for (const w of wods ?? []) daysOf.set(w.box_id as string, [...(daysOf.get(w.box_id as string) ?? []), w.wod_date as string]);
  for (const [k, v] of daysOf) daysOf.set(k, [...new Set(v)].sort());
  const done = new Map<string, Set<string>>();
  for (const r of res ?? []) {
    const key = `${r.box_id}|${r.user_id}`;
    if (!done.has(key)) done.set(key, new Set());
    done.get(key)!.add(r.wods.wod_date);
  }
  const { data: everIds } = await db.from("results").select("user_id, box_id").in("user_id", ids).limit(10000);
  const ever = new Set((everIds ?? []).map((r) => `${r.box_id}|${r.user_id}`));
  const person = new Map((people ?? []).map((p) => [p.id as string, p]));

  const reminded = new Set<string>();
  let sent = 0;
  // Como mucho un recordatorio por persona y día, aunque esté en varios boxes
  for (const m of mems ?? []) {
    const p = person.get(m.user_id);
    if (!p || reminded.has(p.id) || m.boxes.competition) continue;
    const allDays = daysOf.get(m.box_id) ?? [];
    const days = allDays.filter((d) => d <= today);
    const weekPlan = allDays.filter((d) => d >= weekStart);
    const todayHasWod = days.includes(today);
    const mine = done.get(`${m.box_id}|${p.id}`) ?? new Set<string>();
    const name = (p.first_name || p.full_name || "").split(" ")[0];
    const last = p.last_reminder_at ? Date.parse(p.last_reminder_at) : 0;
    const hoursSince = (Date.now() - last) / 36e5;
    const past = days.filter((d) => d < today);

    // Racha semanal: si hoy no entrena, ¿todavía llega a los 5 días de esta semana?
    const st = computeStreak(days, mine, today);
    const goal = Math.min(WEEK_GOAL, weekPlan.length);
    const need = goal - st.weekDone;
    const left = weekPlan.filter((d) => d >= today).length; // días de plani que quedan, hoy incluido

    let msg: { title: string; body: string; url: string } | null = null;
    if (todayHasWod && !mine.has(today) && st.current >= 1 && need > 0 && left <= need && hoursSince > 20) {
      msg = {
        title: `🔥 ${st.current} ${st.current === 1 ? "semana" : "semanas"} seguidas${name ? `, ${name}` : ""}`,
        body: `Te ${need === 1 ? "queda 1 día" : `quedan ${need} días`} para cumplir esta semana en ${m.boxes.name}. Mete el resultado de hoy y no pierdas la racha.`,
        url: "/",
      };
    } else if (todayHasWod && !mine.has(today) && st.days >= 3 && hoursSince > 20) {
      msg = {
        title: `🔥 ${st.days} días seguidos${name ? `, ${name}` : ""}`,
        body: "Hoy hay WOD y aún no has metido tu resultado. No rompas la racha.",
        url: "/",
      };
    } else if (!ever.has(`${m.box_id}|${p.id}`)) {
      const ageDays = (Date.now() - Date.parse(m.joined_at)) / 864e5;
      if (ageDays >= 2 && !p.last_reminder_at) msg = { title: "👟 Tu primer resultado te espera", body: "Mete el resultado del WOD de hoy y estrena tu primera medalla.", url: "/" };
    } else {
      let missed = 0;
      for (let i = past.length - 1; i >= 0 && !mine.has(past[i]); i--) missed++;
      if (missed >= 3 && missed <= 30 && hoursSince > 96 && !mine.has(today))
        msg = { title: `💪 ${name ? `${name}, t` : "T"}e echamos de menos`, body: `Llevas ${missed} días de plani sin meter resultado. ¡Vuelve a sumar!`, url: "/" };
    }
    if (!msg) continue;
    const n = await sendPush([p.id], "reminders", { ...msg, tag: "reminder", box: m.boxes.slug });
    if (n > 0) {
      sent++;
      reminded.add(p.id);
    }
  }
  if (reminded.size) await db.from("profiles").update({ last_reminder_at: new Date().toISOString() }).in("id", [...reminded]);
  return NextResponse.json({ sent, checked: (people ?? []).length, medalUsers, riskBoxes });
}
