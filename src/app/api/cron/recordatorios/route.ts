import { NextResponse } from "next/server";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { addDays, todayISO } from "@/lib/dates";
import { syncMedalsForClosedWods } from "@/lib/achievements";
import { sendWeeklySummaries } from "@/lib/weekly";

/**
 * Recordatorios diarios (Vercel Cron, a última hora de la tarde). Solo a quien tiene push y los recordatorios activados:
 *  · Racha en peligro: hoy hay plani, aún no ha metido resultado y lleva 3+ días seguidos.
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

  let medalUsers = 0;
  try {
    medalUsers = await syncMedalsForClosedWods(db, today);
  } catch {
    // si falla, que no impida los recordatorios
  }

  const { data: subs } = await db.from("push_subscriptions").select("user_id");
  const ids = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  if (!ids.length) return NextResponse.json({ sent: 0, medalUsers });

  // Domingo: resumen semanal personal (en vez de los recordatorios, para no mandar dos avisos)
  if (new Date(today + "T12:00:00Z").getUTCDay() === 0) {
    const weekly = await sendWeeklySummaries(db, today, ids).catch((e) => {
      console.error("weekly", e);
      return 0;
    });
    return NextResponse.json({ weekly, medalUsers });
  }

  type Mem = { user_id: string; box_id: string; joined_at: string; boxes: { slug: string; name: string } };
  const [{ data: people }, { data: mems }, { data: wods }, { data: res }] = await Promise.all([
    db.from("profiles").select("id, first_name, full_name, last_reminder_at").in("id", ids).eq("active", true).eq("notify_reminders", true),
    db.from("box_members").select("user_id, box_id, joined_at, boxes!inner(slug, name)").in("user_id", ids).eq("active", true).returns<Mem[]>(),
    db.from("wods").select("box_id, wod_date").eq("published", true).gte("wod_date", since).lte("wod_date", today),
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
    if (!p || reminded.has(p.id)) continue;
    const days = daysOf.get(m.box_id) ?? [];
    const todayHasWod = days.includes(today);
    const mine = done.get(`${m.box_id}|${p.id}`) ?? new Set<string>();
    const name = (p.first_name || p.full_name || "").split(" ")[0];
    const last = p.last_reminder_at ? Date.parse(p.last_reminder_at) : 0;
    const hoursSince = (Date.now() - last) / 36e5;
    const past = days.filter((d) => d < today);

    // Racha actual hasta ayer
    let streak = 0;
    for (let i = past.length - 1; i >= 0 && mine.has(past[i]); i--) streak++;

    let msg: { title: string; body: string; url: string } | null = null;
    if (todayHasWod && !mine.has(today) && streak >= 3 && hoursSince > 20) {
      msg = { title: `🔥 ${streak} días seguidos${name ? `, ${name}` : ""}`, body: `Aún no has metido el resultado de hoy en ${m.boxes.name}. ¡No pierdas la racha!`, url: "/" };
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
  return NextResponse.json({ sent, checked: (people ?? []).length, medalUsers });
}
