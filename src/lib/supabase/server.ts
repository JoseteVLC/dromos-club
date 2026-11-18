import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Box, Profile } from "@/lib/types";
import { BOX_COOKIE, isValidSlug, slugFromHost } from "@/lib/box-shared";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Box activo: el del subdominio (cuando haya dominio) o el elegido (cookie). */
export async function currentBoxSlug(): Promise<string | null> {
  const fromHost = slugFromHost((await headers()).get("host"));
  if (fromHost) return fromHost;
  const c = (await cookies()).get(BOX_COOKIE)?.value ?? "";
  return isValidSlug(c) ? c : null;
}

/**
 * Cliente de Supabase con la sesión del usuario. Manda el box activo en la cabecera «x-box»:
 * las reglas de seguridad de la base de datos solo dejan ver y tocar ese box (y solo si eres miembro).
 */
export async function createClient(boxSlug?: string | null) {
  const cookieStore = await cookies();
  const slug = boxSlug === undefined ? await currentBoxSlug() : boxSlug;
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: slug ? { "x-box": slug } : {} },
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
export const requireSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const user = { id: claims.sub, email: (claims.email as string | undefined) ?? "" };
  return { supabase, user };
});

type MemberRow = { role: "athlete" | "coach" | "admin"; active: boolean; joined_at: string; boxes: Box };

/**
 * Usuario + perfil + box activo. Redirige a /login si no hay sesión y a /boxes si no hay box elegido
 * (o no eres miembro). El rol, «activo» y la fecha de alta del perfil son los de ESTE box,
 * así el resto de la app (coach, admin, plani desde el alta) funciona igual que con un solo box.
 */
export const requireUser = cache(async () => {
  const { supabase, user } = await requireSession();
  const slug = await currentBoxSlug();
  if (!slug) redirect("/boxes");

  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, gender, role, is_admin, active, first_name, last_name, division, avatar_url, bio, instagram, show_box, show_age, created_at, messages_seen_at")
      .eq("id", user.id)
      .single<Profile>(),
    supabase
      .from("box_members")
      .select("role, active, joined_at, boxes!inner(id, slug, name, logo_url, accent, rewards_enabled, status)")
      .eq("user_id", user.id)
      .eq("boxes.slug", slug)
      .maybeSingle<MemberRow>(),
  ]);
  if (!member) redirect("/boxes?fuera=" + encodeURIComponent(slug));
  // Cuenta desactivada (en la plataforma o en este box)
  if ((profile && profile.active === false) || !member.active) redirect("/inactivo");

  const box: Box = member.boxes;
  const boxProfile: Profile | null = profile
    ? { ...profile, role: member.role === "athlete" ? "athlete" : "coach", is_admin: member.role === "admin", created_at: member.joined_at, active: true }
    : null;
  return { supabase, user, profile: boxProfile, box, boxRole: member.role };
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
