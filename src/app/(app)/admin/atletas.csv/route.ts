import { requireAdmin } from "@/lib/supabase/server";
import { adminDb, boxPeople, emailsOf } from "@/lib/supabase/admin";
import { MEDALS } from "@/lib/medals";

/** CSV con los datos públicos y privados de todos los atletas (solo admins). */
export async function GET() {
  const { box } = await requireAdmin();
  const db = adminDb();
  type P = { id: string; full_name: string; first_name: string; last_name: string; gender: string | null; division: string | null; box: string | null; phone: string | null; birth_date: string | null; address_line: string | null; postal_code: string | null; city: string | null; country: string | null; shirt_size: string | null; instagram: string | null };
  const [{ people }, { data: ach }] = await Promise.all([
    boxPeople<P>(box.id, "id, full_name, first_name, last_name, gender, division, box, phone, birth_date, address_line, postal_code, city, country, shirt_size, instagram"),
    db.from("user_achievements").select("user_id, code").eq("box_id", box.id),
  ]);
  people.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  const users = await emailsOf(people.map((p) => p.id));
  const medals = new Map<string, number>();
  for (const a of ach ?? []) medals.set(a.user_id, (medals.get(a.user_id) ?? 0) + 1);
  const age = (d: string | null) => (d ? Math.floor((Date.now() - Date.parse(d)) / (365.25 * 864e5)) : "");
  const cols = ["Nombre", "Email", "Teléfono", "Nacimiento", "Edad", "Género", "Nivel", "Box", "Dirección", "C.P.", "Ciudad", "País", "Talla", "Instagram", "Rol", "Activo", "Medallas", "Alta"];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = people.map((p) =>
    [
      p.full_name, users.get(p.id) ?? "", p.phone, p.birth_date, age(p.birth_date), p.gender, p.division, p.box,
      p.address_line, p.postal_code, p.city, p.country, p.shirt_size, p.instagram ? `@${p.instagram}` : "",
      p.is_admin ? "admin" : p.role, p.active ? "sí" : "no", `${medals.get(p.id) ?? 0}/${MEDALS.length}`, String(p.created_at).slice(0, 10),
    ].map(esc).join(";"),
  );
  // BOM + punto y coma: Excel en español lo abre bien a la primera
  const body = "﻿" + [cols.join(";"), ...rows].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atletas-${box.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
