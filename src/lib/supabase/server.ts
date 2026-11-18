import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: el proxy ya refresca la sesión.
        }
      },
    },
  });
}

/**
 * Usuario + perfil actual. Redirige a /login si no hay sesión.
 * getClaims() verifica el JWT en local (sin ir al servidor de Auth), mucho más rápido que getUser().
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const user = { id: claims.sub, email: (claims.email as string | undefined) ?? "" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, gender, role, is_admin, active, first_name, last_name, division, avatar_url, bio, instagram, show_box, show_age, created_at, messages_seen_at")
    .eq("id", user.id)
    .single<Profile>();

  // Cuenta desactivada por un admin: fuera
  if (profile && profile.active === false) redirect("/inactivo");

  return { supabase, user, profile };
});

/**
 * Primer día de plani que puede ver y en el que puede participar un atleta: el día de su alta.
 * Los coaches y admins lo ven todo (devuelve null).
 */
export function memberSince(p: Profile | null | undefined): string | null {
  if (!p || isCoachProfile(p) || !p.created_at) return null;
  return new Date(p.created_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}

export const isCoachProfile = (p: Profile | null | undefined) => !!p && (p.role === "coach" || !!p.is_admin);

export async function requireCoach() {
  const ctx = await requireUser();
  if (!isCoachProfile(ctx.profile)) redirect("/");
  return ctx;
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (!ctx.profile?.is_admin) redirect("/");
  return ctx;
}
