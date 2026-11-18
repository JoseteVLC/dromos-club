import "server-only";
import { cache } from "react";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";

/** Datos públicos de un box por su slug (nombre y logo), para pantallas sin sesión y el icono de la app. */
export const publicBox = cache(async (slug: string | null) => {
  if (!slug || !hasAdminKey()) return null;
  const { data } = await adminDb().from("boxes").select("slug, name, logo_url, accent").eq("slug", slug).maybeSingle<{ slug: string; name: string; logo_url: string | null; accent: string | null }>();
  return data ?? null;
});
