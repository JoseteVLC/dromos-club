import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./server";

/** Cliente con la secret key: salta RLS. Solo para acciones de admin y para aceptar invitaciones. */
let cached: SupabaseClient | null = null;
/** Limpia la clave por si se pegó con espacios, saltos de línea o caracteres de más (p. ej. «→»). */
function secretKey(): string | undefined {
  const raw = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw) return undefined;
  const m = raw.match(/sb_secret_[A-Za-z0-9_-]+/) ?? raw.match(/eyJ[A-Za-z0-9_.-]+/);
  return m ? m[0] : raw.replace(/[^\x21-\x7e]/g, "");
}

export function adminDb() {
  const key = secretKey();
  if (!key) throw new Error("Falta SUPABASE_SECRET_KEY en las variables de entorno.");
  cached ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export function hasAdminKey() {
  return !!secretKey();
}

/** Emails de esas cuentas (solo las indicadas: nunca se listan las de toda la plataforma). */
export async function emailsOf(ids: string[]): Promise<Map<string, string>> {
  const db = adminDb();
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    const res = await Promise.all(batch.map((id) => db.auth.admin.getUserById(id).catch(() => null)));
    res.forEach((r, k) => {
      const email = r?.data?.user?.email;
      if (email) map.set(batch[k], email);
    });
  }
  return map;
}

type MemberJoin<P> = { user_id: string; role: "athlete" | "coach" | "admin"; active: boolean; joined_at: string; profiles: P | null };

/** Personas de un box con su perfil; rol, «activo» y fecha de alta son los del box. */
export async function boxPeople<P extends { id: string }>(boxId: string, profileCols: string) {
  const { data, error } = await adminDb()
    .from("box_members")
    .select(`user_id, role, active, joined_at, profiles!inner(${profileCols})`)
    .eq("box_id", boxId)
    .eq("pending", false)
    .returns<MemberJoin<P>[]>();
  const people = (data ?? [])
    .filter((m) => m.profiles)
    .map((m) => ({ ...(m.profiles as P), role: m.role === "athlete" ? ("athlete" as const) : ("coach" as const), is_admin: m.role === "admin", active: m.active, created_at: m.joined_at }));
  return { people, error };
}
