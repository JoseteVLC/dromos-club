import { NextResponse } from "next/server";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { addDays, todayISO } from "@/lib/dates";
import { syncMedalsForClosedWods } from "@/lib/achievements";

/**
 * Recordatorios diarios (Vercel Cron, a última hora de la tarde). Solo a quien tiene push y los recordatorios activados:
 *  · Racha en peligro: hoy hay plani, aún no ha metido resultado y lleva 3+ días seguidos.
 *  · Te echamos de menos: lleva 3+ días de plani sin meter resultado (como mucho un aviso cada 4 días).
 *  · Primer resultado: se dio de alta hace 2+ días y aún no ha metido ninguno (una sola vez).
 * Antes, reparte las medallas de competición (Podio, Campeón, Dinastía) de los WODs que han cerrado.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const [{ data: people }, { data: wods }, { data: res }] = await Promise.all([
    db.from("profiles").select("id, first_name, full_name, created_at, last_reminder_at").in("id", ids).eq("active", true).eq("notify_reminders", true),
    db.from("wods").select("wod_date").eq("published", true).gte("wod_date", since).lte("wod_date", today),
    db.from("results").select("user_id, wods!inner(wod_date)").in("user_id", ids).gte("wods.wod_date", since).returns<{ user_id: string; wods: { wod_date: string } }[]>(),
  ]);
  const days = [...new Set((wods ?? []).map((w) => w.wod_date as string))].sort();
  const todayHasWod = days.includes(today);
  const done = new Map<string, Set<string>>();
  for (const r of res ?? []) {
    if (!done.has(r.user_id)) done.set(r.user_id, new Set());
    done.get(r.user_id)!.add(r.wods.wod_date);
  }
  const { data: everIds } = await db.from("results").select("user_id").in("user_id", ids).limit(10000);
  const ever = new Set((everIds ?? []).map((r) => r.user_id as string));

  const reminded: string[] = [];
  let sent = 0;
  for (const p of people ?? []) {
    const mine = done.get(p.id) ?? new Set<string>();
    const name = (p.first_name || p.full_name || "").split(" ")[0];
    const last = p.last_reminder_at ? Date.parse(p.last_reminder_at) : 0;
    const hoursSince = (Date.now() - last) / 36e5;
    const past = days.filter((d) => d < today);

    // Racha actual hasta ayer
    let streak = 0;
    for (let i = past.length - 1; i >= 0 && mine.has(past[i]); i--) streak++;

    let msg: { title: string; body: string; url: string } | null = null;
    if (todayHasWod && !mine.has(today) && streak >= 3 && hoursSince > 20) {
      msg = { title: `🔥 ${streak} días seguidos${name ? `, ${name}` : ""}`, body: "Aún no has metido el resultado de hoy. ¡No pierdas la racha!", url: "/" };
    } else if (!ever.has(p.id)) {
      const ageDays = (Date.now() - Date.parse(p.created_at)) / 864e5;
      if (ageDays >= 2 && !p.last_reminder_at) msg = { title: "👟 Tu primer resultado te espera", body: "Mete el resultado del WOD de hoy y estrena tu primera medalla.", url: "/" };
    } else {
      let missed = 0;
      for (let i = past.length - 1; i >= 0 && !mine.has(past[i]); i--) missed++;
      if (missed >= 3 && missed <= 30 && hoursSince > 96 && !mine.has(today))
        msg = { title: `💪 ${name ? `${name}, t` : "T"}e echamos de menos`, body: `Llevas ${missed} días de plani sin meter resultado. ¡Vuelve a sumar!`, url: "/" };
    }
    if (!msg) continue;
    const n = await sendPush([p.id], "reminders", { ...msg, tag: "reminder" });
    if (n > 0) {
      sent++;
      reminded.push(p.id);
    }
  }
  if (reminded.length) await db.from("profiles").update({ last_reminder_at: new Date().toISOString() }).in("id", reminded);
  return NextResponse.json({ sent, checked: (people ?? []).length, medalUsers });
}
