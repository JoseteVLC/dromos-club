import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { BOX_COOKIE, isValidSlug } from "@/lib/box-shared";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/public-config";

const PUBLIC_PATHS = ["/login", "/auth", "/invitacion", "/nuevo-box", "/unirse", "/sw.js", "/api/cron"];

export async function proxy(request: NextRequest) {
  // Entrada a un box por su dirección (/cfvalencia): lo recordamos y vamos a su inicio.
  // Cuando haya dominio propio, el box saldrá del subdominio y esto solo servirá de redirección.
  const seg = request.nextUrl.pathname.split("/").filter(Boolean);
  if (seg.length === 1 && isValidSlug(seg[0].toLowerCase())) {
    // ?a=/ruta: abrir directamente esa pantalla del box (enlaces de avisos)
    const next = request.nextUrl.searchParams.get("a") ?? "/";
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next.split("?")[0] : "/";
    const res = NextResponse.redirect(url);
    res.cookies.set(BOX_COOKIE, seg[0].toLowerCase(), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Refresca la sesión si hace falta y verifica el JWT en local
  // (no meter código entre createServerClient y getClaims)
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub;

  const path = request.nextUrl.pathname;
  if (!user && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf)$).*)"],
};
