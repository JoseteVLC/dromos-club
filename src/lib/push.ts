import "server-only";
import * as webpush from "web-push";
import { adminDb, hasAdminKey } from "./supabase/admin";
import { BRAND } from "@/lib/brand";

/** Tipos de aviso; cada uno respeta la preferencia del atleta en su perfil. */
export type PushKind = "social" | "medals" | "messages" | "reminders";
const PREF: Record<PushKind, string> = {
  social: "notify_social",
  medals: "notify_medals",
  messages: "notify_messages",
  reminders: "notify_reminders",
};

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured: boolean | null = null;
function ready() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BKsMIOjeT5-Y5CJaprXtor1mdsSbICz_kp9aW0YqqZg8h8t8oMDy5iQJ4kM-E-YtYVZamacJouUIdnYT_PLCmDA";
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv && hasAdminKey());
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${BRAND.email}`, pub!, priv!);
  return configured;
}

/**
 * Envía un push a esos usuarios (a todos sus dispositivos), solo si tienen ese tipo de aviso activado.
 * Nunca lanza error: si algo falla, la acción que lo llamó sigue normal.
 */
export async function sendPush(userIds: string[], kind: PushKind, payload: PushPayload) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length || !ready()) return 0;
  try {
    const db = adminDb();
    const { data: allowed } = await db.from("profiles").select("id").in("id", ids).eq(PREF[kind], true).eq("active", true);
    const ok = (allowed ?? []).map((p) => p.id as string);
    if (!ok.length) return 0;
    const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ok);
    const body = JSON.stringify({ ...payload, url: payload.url ?? "/" });
    const dead: string[] = [];
    let sent = 0;
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: "normal" });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) dead.push(s.id); // dispositivo dado de baja
        }
      }),
    );
    if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
    return sent;
  } catch {
    return 0;
  }
}

/** Todos los coaches y admins activos (para avisarles de mensajes de atletas). */
export async function staffIds() {
  if (!hasAdminKey()) return [];
  const { data } = await adminDb().from("profiles").select("id").eq("active", true).or("role.eq.coach,is_admin.eq.true");
  return (data ?? []).map((p) => p.id as string);
}

/** Todos los atletas activos (para anuncios). */
export async function allActiveIds() {
  if (!hasAdminKey()) return [];
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await adminDb().from("profiles").select("id").eq("active", true).range(from, from + 999);
    out.push(...(data ?? []).map((p) => p.id as string));
    if (!data || data.length < 1000) return out;
  }
}
