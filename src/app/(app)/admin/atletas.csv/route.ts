import { requireAdmin } from "@/lib/supabase/server";
import { adminDb } from "@/lib/supabase/admin";
import { MEDALS } from "@/lib/medals";
import { BRAND } from "@/lib/brand";

/** CSV con los datos públicos y privados de todos los atletas (solo admins). */
export async function GET() {
  await requireAdmin();
  const db = adminDb();
  const [{ data: people }, { data: ach }, users] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, first_name, last_name, gender, division, role, active, box, phone, birth_date, address_line, postal_code, city, country, shirt_size, instagram, created_at")
      .order("full_name"),
    db.from("user_achievements").select("user_id, code"),
    (async () => {
      const map = new Map<string, string>();
      for (let page = 1; page < 50; page++) {
        const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        for (const u of data?.users ?? []) map.set(u.id, u.email ?? "");
        if (!data || data.users.length < 1000) break;
      }
      return map;
    })(),
  ]);
  const medals = new Map<string, number>();
  for (const a of ach ?? []) medals.set(a.user_id, (medals.get(a.user_id) ?? 0) + 1);
  const age = (d: string | null) => (d ? Math.floor((Date.now() - Date.parse(d)) / (365.25 * 864e5)) : "");
  const cols = ["Nombre", "Email", "Teléfono", "Nacimiento", "Edad", "Género", "Nivel", "Box", "Dirección", "C.P.", "Ciudad", "País", "Talla", "Instagram", "Rol", "Activo", "Medallas", "Alta"];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = (people ?? []).map((p) =>
    [
      p.full_name, users.get(p.id) ?? "", p.phone, p.birth_date, age(p.birth_date), p.gender, p.division, p.box,
      p.address_line, p.postal_code, p.city, p.country, p.shirt_size, p.instagram ? `@${p.instagram}` : "",
      p.role, p.active ? "sí" : "no", `${medals.get(p.id) ?? 0}/${MEDALS.length}`, String(p.created_at).slice(0, 10),
    ].map(esc).join(";"),
  );
  // BOM + punto y coma: Excel en español lo abre bien a la primera
  const body = "﻿" + [cols.join(";"), ...rows].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atletas-${BRAND.short.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
