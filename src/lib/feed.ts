import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";

/**
 * Fotos de los resultados: el bucket es privado y aquí se firman enlaces de 1 hora.
 * Solo se llaman con resultados que quien mira ya ha podido leer (RLS), y solo se firma
 * una ruta que esté en la carpeta del dueño del resultado.
 */
export async function signResultPhotos(rows: { id: string; user_id: string; photo_path?: string | null }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = rows.filter((r) => r.photo_path && r.photo_path.startsWith(`${r.user_id}/`));
  if (!list.length || !hasAdminKey()) return out;
  const { data } = await adminDb().storage.from("result-photos").createSignedUrls(list.map((r) => r.photo_path!), 3600);
  const byPath = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  for (const r of list) {
    const u = byPath.get(r.photo_path!);
    if (u) out.set(r.id, u);
  }
  return out;
}

export type Legend = { kind: "box" | "benchmark"; label: string; user_id: string; n: number };

/** Leyendas del box activo (título vivo: se gana y se pierde). */
export async function getLegends(supabase: SupabaseClient): Promise<Legend[]> {
  const { data } = await supabase.rpc("legends");
  return (data as Legend[] | null) ?? [];
}

/** Por atleta, sus títulos de Leyenda */
export function legendsByUser(list: Legend[]): Map<string, Legend[]> {
  const m = new Map<string, Legend[]>();
  for (const l of list) m.set(l.user_id, [...(m.get(l.user_id) ?? []), l]);
  return m;
}

/** 👊 y 🔥 que ha recibido un atleta en todos sus resultados */
export async function getKudos(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const { data } = await supabase.rpc("kudos_received", { p_user: userId });
  return Object.fromEntries(((data as { emoji: string; n: number }[] | null) ?? []).map((k) => [k.emoji, k.n]));
}
