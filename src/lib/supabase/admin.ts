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
